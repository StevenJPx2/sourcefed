// Slack limits Web API calls per method, per workspace, per app, and answers a call over
// the limit with HTTP 429 and Retry-After. conversations.replies is Tier 3 (50+ a minute)
// for internal apps; 20 a minute keeps every monitor on a token well inside it.
const DEFAULT_REQUESTS_PER_MINUTE = 20

// The burst covers one runtime tick (5s by default) at the budget's rate, and at least two.
const BURST_WINDOW_SEC = 5
const MIN_BURST = 2

// A waiter must also be silent this long before it is dropped, so ticks that overlap (the
// runtime starts one every few seconds whether or not the last has finished) drop nobody.
const MIN_WAITER_SILENCE_MS = 15_000
// Monitors that asked within this window count as held back by a rate-limit wait.
const MEMBER_WINDOW_MS = 10 * 60_000

export type SlackLimiterOptions = {
  requestsPerMinute: number
  now: () => number
  log: (line: string) => void
}

type Waiter = { lastAsked: number; seq: number }

type TokenBudget = {
  credit: number
  refilledAt: number
  pausedUntil: number
  queue: string[]
  waiters: Map<string, Waiter>
  seq: number
}

/**
 * Shares one Slack request budget between every monitor polling with the same token.
 *
 * Requests refill at `requestsPerMinute`, with a burst of about one runtime tick's worth.
 * Monitors refused a request wait in arrival order and are served in turn. A
 * rate-limited answer pauses the whole token until Slack's Retry-After has passed.
 */
export class SlackRateLimiter {
  private readonly budgets = new Map<string, TokenBudget>()
  readonly burst: number

  constructor(private readonly options: SlackLimiterOptions) {
    const perTick = Math.ceil((options.requestsPerMinute * BURST_WINDOW_SEC) / 60)
    this.burst = Math.max(1, Math.min(Math.floor(options.requestsPerMinute), Math.max(MIN_BURST, perTick)))
  }

  /** Takes one request for `key` (one monitor's source); false defers the poll. */
  acquire(token: string, key: string): boolean {
    const now = this.options.now()
    const budget = this.budget(token, now)
    this.ask(budget, key, now)
    if (now < budget.pausedUntil) return false

    this.refill(budget, now)
    if (budget.credit < 1 || budget.queue[0] !== key) return false
    budget.queue.shift()
    budget.credit -= 1
    return true
  }

  /** Charges a follow-up request that must go out now, such as a page of a first read. */
  charge(token: string): void {
    const now = this.options.now()
    const budget = this.budget(token, now)
    this.refill(budget, now)
    budget.credit -= 1
  }

  /** Takes a follow-up request, such as a further page, for a read already granted. */
  spend(token: string): boolean {
    const now = this.options.now()
    const budget = this.budget(token, now)
    if (now < budget.pausedUntil) return false
    this.refill(budget, now)
    if (budget.credit < 1) return false
    budget.credit -= 1
    return true
  }

  /** Holds every monitor on `token` until Slack's Retry-After has passed; logs once per wait. */
  pause(token: string, retryAfterSec: number, method: string): void {
    const now = this.options.now()
    const budget = this.budget(token, now)
    const until = now + retryAfterSec * 1000
    if (until <= budget.pausedUntil) return
    const continuing = now < budget.pausedUntil
    budget.pausedUntil = until
    budget.credit = 0
    budget.refilledAt = until
    if (continuing) return

    const monitors = [...budget.waiters.values()].filter((waiter) => now - waiter.lastAsked <= MEMBER_WINDOW_MS).length
    this.options.log(
      `[sourcefed] Slack rate-limited ${method}: waiting ${retryAfterSec}s before polling ${monitors} Slack monitor${monitors === 1 ? "" : "s"} on this token again`,
    )
  }

  /** The time until which `token` is paused, or 0. */
  pausedUntil(token: string): number {
    return this.budgets.get(token)?.pausedUntil ?? 0
  }

  private budget(token: string, now: number): TokenBudget {
    let budget = this.budgets.get(token)
    if (!budget) {
      budget = { credit: this.burst, refilledAt: now, pausedUntil: 0, queue: [], waiters: new Map(), seq: 0 }
      this.budgets.set(token, budget)
    }
    return budget
  }

  // Every due monitor asks once per runtime tick, in the same order. A waiter that has not
  // asked since this key last asked missed a whole tick, so it stopped (removed, disabled, or
  // moved to a webhook) and must not hold the queue, however long a tick is.
  private ask(budget: TokenBudget, key: string, now: number): void {
    const previous = budget.waiters.get(key)
    budget.seq += 1
    budget.waiters.set(key, { lastAsked: now, seq: budget.seq })
    if (previous) {
      budget.queue = budget.queue.filter((waiting) => {
        const waiter = budget.waiters.get(waiting)
        if (!waiter) return false
        return waiter.seq > previous.seq || now - waiter.lastAsked < MIN_WAITER_SILENCE_MS
      })
    }
    for (const [waiting, waiter] of budget.waiters) {
      if (now - waiter.lastAsked > MEMBER_WINDOW_MS) budget.waiters.delete(waiting)
    }
    if (!budget.queue.includes(key)) budget.queue.push(key)
  }

  private refill(budget: TokenBudget, now: number): void {
    if (now <= budget.refilledAt) return
    const earned = ((now - budget.refilledAt) / 60_000) * this.options.requestsPerMinute
    budget.credit = Math.min(this.burst, budget.credit + earned)
    budget.refilledAt = now
  }
}

/** Reads SOURCEFED_SLACK_REQUESTS_PER_MINUTE, falling back to 20 a minute. */
export function slackRequestsPerMinute(value = process.env.SOURCEFED_SLACK_REQUESTS_PER_MINUTE): number {
  const parsed = Number(value)
  if (value === undefined || value.trim() === "" || !Number.isFinite(parsed) || parsed <= 0) return DEFAULT_REQUESTS_PER_MINUTE
  return parsed
}
