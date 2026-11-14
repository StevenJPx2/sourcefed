import type { SourcePollDeferred } from "@sourcefed/core"
import { MAX_RETRY_AFTER_SEC, SlackRateLimiter, slackRequestsPerMinute } from "./slack-limiter.ts"

const SLACK_API = "https://slack.com/api"

// users.list is rate limited to about 20 calls a minute and pages 200 members at
// a time, so every monitor fetching it on every poll keeps it rate limited. One
// shared list per token, refreshed hourly, names authors well enough.
const USERS_TTL_MS = 60 * 60 * 1000

// Slack always sends Retry-After with a 429; this covers an answer without a usable one.
const DEFAULT_RETRY_AFTER_SEC = 60

type SlackUser = { id: string; name: string; real_name: string }
type SlackReply =
  | { ok: true; result: any }
  | { ok: false; error: string; retryAfterSec?: number }

export type SlackRead = { messages: any[]; users: SlackUser[] }

/**
 * Which messages a poll asks for. `after` is the newest message the monitor has seen, and
 * `first` marks the read that primes a new monitor.
 */
export type SlackReadRequest = { monitorId: string; after?: string; first?: boolean }

/**
 * How a read pages. Thread replies come oldest first, so a read cut short still moves the
 * cursor forward safely; a DM's history comes newest first, so it must read every page.
 */
type ReadPlan = {
  method: "conversations.replies" | "conversations.history"
  params: Record<string, string>
  request: SlackReadRequest
  oldestFirst: boolean
}

const DEFERRED: SourcePollDeferred = { deferred: true }

const users = new Map<string, { list: SlackUser[]; fetchedAt: number }>()
const refreshing = new Map<string, Promise<SlackUser[]>>()
// users.list is limited separately from the conversation methods, so its wait is its own.
const usersPausedUntil = new Map<string, number>()
let limiter = defaultLimiter()

export async function fetchSlackThread(channelId: string, threadTs: string, request: SlackReadRequest): Promise<SlackRead | SourcePollDeferred> {
  const params = { channel: channelId, ts: threadTs, inclusive: "false", ...(request.after ? { oldest: request.after } : {}) }
  return readSlack({ method: "conversations.replies", params, request, oldestFirst: true })
}

export async function fetchSlackDm(channelId: string, request: SlackReadRequest): Promise<SlackRead | SourcePollDeferred> {
  const params = { channel: channelId, inclusive: "false", ...(request.after ? { oldest: request.after } : {}) }
  return readSlack({ method: "conversations.history", params, request, oldestFirst: false })
}

/** Forget the cached user lists and the request budgets, so a test starts from scratch. */
export function resetSlackApi(next: SlackRateLimiter = defaultLimiter()): void {
  users.clear()
  refreshing.clear()
  usersPausedUntil.clear()
  limiter = next
}

function defaultLimiter(): SlackRateLimiter {
  return new SlackRateLimiter({
    requestsPerMinute: slackRequestsPerMinute(),
    now: () => Date.now(),
    log: (line) => console.warn(line),
  })
}

// A poll takes one request from its token's budget, or is deferred without calling Slack.
// A primed thread poll may stop at any page and continue next time, so its further pages
// wait for budget, and a rate limit part-way through keeps the pages read so far. Any other
// read must finish to be safe: its pages go at once (later polls on the token pay them
// back), and a rate limit or a wait started by another poll defers the whole read.
async function readSlack(plan: ReadPlan): Promise<SlackRead | SourcePollDeferred> {
  const token = process.env.SOURCEFED_SLACK_TOKEN
  if (!token) throw new Error(`slack ${plan.method} failed: SOURCEFED_SLACK_TOKEN is not set`)
  const priming = plan.request.after === undefined
  if (!limiter.acquire(token, plan.request.monitorId, plan.request.first === true)) return DEFERRED

  const keepsPartial = plan.oldestFirst && !priming
  const messages: any[] = []
  let cursor = ""
  do {
    if (cursor && keepsPartial && !limiter.spend(token)) break
    if (cursor && !keepsPartial && !limiter.charge(token)) return DEFERRED
    const page = await slackApi(token, plan.method, { ...plan.params, limit: "1000", ...(cursor ? { cursor } : {}) })
    if (!page.ok) {
      if (page.retryAfterSec !== undefined) limiter.pause(token, page.retryAfterSec, plan.method, plan.request.monitorId)
      if (messages.length > 0 && keepsPartial) break
      if (page.retryAfterSec !== undefined) return DEFERRED
      throw new Error(`slack ${plan.method} failed: ${page.error}`)
    }
    if (Array.isArray(page.result.messages)) messages.push(...page.result.messages)
    cursor = page.result.response_metadata?.next_cursor ?? ""
    // A DM's newest page is enough to prime it: older messages are history either way.
    if (!plan.oldestFirst && priming) break
    if (messages.length >= 10_000) break
  } while (cursor)
  return { messages, users: await slackUsers(token) }
}

async function slackUsers(token: string): Promise<SlackUser[]> {
  const cached = users.get(token)
  if (cached && Date.now() - cached.fetchedAt < USERS_TTL_MS) return cached.list
  if (Date.now() < (usersPausedUntil.get(token) ?? 0)) return cached?.list ?? []
  let pending = refreshing.get(token)
  if (!pending) {
    pending = refreshUsers(token).finally(() => refreshing.delete(token))
    refreshing.set(token, pending)
  }
  return pending
}

// A failed or partial refresh keeps the last full list and retries next poll.
async function refreshUsers(token: string): Promise<SlackUser[]> {
  const list: SlackUser[] = []
  let cursor = ""
  do {
    const page = await slackApi(token, "users.list", { limit: "200", ...(cursor ? { cursor } : {}) })
    if (!page.ok) {
      if (page.retryAfterSec !== undefined) usersPausedUntil.set(token, Date.now() + Math.min(page.retryAfterSec, MAX_RETRY_AFTER_SEC) * 1000)
      return users.get(token)?.list ?? list
    }
    if (Array.isArray(page.result.members)) {
      list.push(...page.result.members.map((member: any) => ({ id: member.id, name: member.name, real_name: member.real_name })))
    }
    cursor = page.result.response_metadata?.next_cursor ?? ""
  } while (cursor)
  users.set(token, { list, fetchedAt: Date.now() })
  return list
}

async function slackApi(token: string, method: string, params: Record<string, string>): Promise<SlackReply> {
  try {
    const response = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    })
    const result = (await response.json().catch(() => undefined)) as { ok?: boolean; error?: string } | undefined
    if (response.ok && result?.ok === true) return { ok: true, result }
    const error = result?.error ?? `HTTP ${response.status}`
    if (response.status === 429 || error === "ratelimited") return { ok: false, error, retryAfterSec: retryAfter(response) }
    return { ok: false, error }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// Retry-After in seconds; "0" still waits a second. Missing or not a number waits a minute.
export function retryAfter(response: Response): number {
  const header = response.headers.get("retry-after")?.trim() ?? ""
  const seconds = Number(header)
  if (header === "" || !Number.isFinite(seconds) || seconds < 0) return DEFAULT_RETRY_AFTER_SEC
  return Math.max(1, Math.ceil(seconds))
}
