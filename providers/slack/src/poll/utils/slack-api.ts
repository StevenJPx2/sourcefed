const SLACK_API = "https://slack.com/api"

// users.list is rate limited to about 20 calls a minute and pages 200 members at
// a time, so every monitor fetching it on every poll keeps it rate limited. One
// shared list, refreshed hourly, names authors well enough.
const USERS_TTL_MS = 60 * 60 * 1000

type SlackUser = { id: string; name: string; real_name: string }
type SlackReply = { ok: true; result: any } | { ok: false; error: string }

let users: { list: SlackUser[]; fetchedAt: number } | undefined
let refreshing: Promise<SlackUser[]> | undefined

export async function fetchSlackThread(channelId: string, threadTs: string): Promise<{ messages: any[]; users: SlackUser[] }> {
  return fetchSlackMessages("conversations.replies", { channel: channelId, ts: threadTs, inclusive: "false" })
}

export async function fetchSlackDm(channelId: string): Promise<{ messages: any[]; users: SlackUser[] }> {
  return fetchSlackMessages("conversations.history", { channel: channelId })
}

/** Forget the cached user list, so a test starts from an empty cache. */
export function resetSlackUsers(): void {
  users = undefined
  refreshing = undefined
}

async function fetchSlackMessages(method: string, params: Record<string, string>): Promise<{ messages: any[]; users: SlackUser[] }> {
  const messages: any[] = []
  let cursor = ""
  do {
    const page = await slackApi(method, { ...params, limit: "1000", ...(cursor ? { cursor } : {}) })
    if (!page.ok) {
      // A later page failing still leaves the messages read so far.
      if (messages.length > 0) break
      throw new Error(`slack ${method} failed: ${page.error}`)
    }
    if (Array.isArray(page.result.messages)) messages.push(...page.result.messages)
    cursor = page.result.response_metadata?.next_cursor ?? ""
    if (messages.length >= 10_000) break
  } while (cursor)
  return { messages, users: await slackUsers() }
}

async function slackUsers(): Promise<SlackUser[]> {
  if (users && Date.now() - users.fetchedAt < USERS_TTL_MS) return users.list
  refreshing ??= refreshUsers().finally(() => {
    refreshing = undefined
  })
  return refreshing
}

// A failed or partial refresh keeps the last full list and retries next poll.
async function refreshUsers(): Promise<SlackUser[]> {
  const list: SlackUser[] = []
  let cursor = ""
  do {
    const page = await slackApi("users.list", { limit: "200", ...(cursor ? { cursor } : {}) })
    if (!page.ok) return users?.list ?? list
    if (Array.isArray(page.result.members)) {
      list.push(...page.result.members.map((member: any) => ({ id: member.id, name: member.name, real_name: member.real_name })))
    }
    cursor = page.result.response_metadata?.next_cursor ?? ""
  } while (cursor)
  users = { list, fetchedAt: Date.now() }
  return list
}

async function slackApi(method: string, params: Record<string, string>): Promise<SlackReply> {
  const token = process.env.SOURCEFED_SLACK_TOKEN
  if (!token) return { ok: false, error: "SOURCEFED_SLACK_TOKEN is not set" }
  try {
    const response = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    })
    const result = (await response.json().catch(() => undefined)) as { ok?: boolean; error?: string } | undefined
    if (response.ok && result?.ok === true) return { ok: true, result }
    return { ok: false, error: result?.error ?? `HTTP ${response.status}` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
