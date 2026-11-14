// Slack limits Web API calls per method, per workspace, per app, and answers a call over
// the limit with HTTP 429 and Retry-After. conversations.replies and conversations.history
// are Tier 3 (50+ a minute) for internal apps; 20 a minute keeps every monitor on a token
// well inside it.
const DEFAULT_REQUESTS_PER_MINUTE = 20
// The budget is shared by conversations.replies and conversations.history, both Tier 3, so
// a budget above Tier 3's 50 a minute could send one method past its own limit.
export const MAX_REQUESTS_PER_MINUTE = 50

// The burst covers one runtime tick (5s by default) at the budget's rate, and at least three,
// so credit earned between two 5-second ticks (1.7 at 20 a minute) is not discarded.
const BURST_WINDOW_SEC = 5
const MIN_BURST = 3

// A waiter must also be silent this long before it is dropped, so ticks that overlap (the
// runtime starts one every few seconds whether or not the last has finished) drop nobody.
const MIN_WAITER_SILENCE_MS = 15_000
// A monitor that has not asked for this long is forgotten, which bounds the memory kept.
const WAITER_FORGET_MS = 10 * 60_000

// Slack's Retry-After is normally under a minute; a longer one is honoured up to an hour,
// so one odd answer cannot silence every monitor on the token for days.
export const MAX_RETRY_AFTER_SEC = 60 * 60

export type SlackLimiterOptions = {
  requestsPerMinute: number
  now: () => number
  log: (line: string) => void
}

type Waiter = { lastAsked: number; seq: number }

// One Retry-After wait. Its log line is written once every monitor held back has asked:
// when the monitor that hit the limit asks again (a whole tick later), or the wait ends.
type Wait = {
  method: string
  startedAt: number
  askedSec: number
  first: string
  held: Set<string>
  logged: boolean
}

type TokenBudget = {
  credit: number
  refilledAt: number
  pausedUntil: number
  queue: string[]
  waiters: Map<string, Waiter>
  seq: number
  wait?: Wait
}

/**
 * Shares one Slack request budget between every monitor polling with the same token.
 *
 * Requests refill at `requestsPerMinute`, with a burst of about one runtime tick's worth.
 * Monitors refused a request wait in arrival order and are served in turn; a monitor's
 * first read goes to the head of the queue. A rate-limited answer pauses the whole token
 * until Slack's Retry-After has passed.
 */
export class SlackRateLimiter {
  private readonly budgets = new Map<string, TokenBudget>()
  readonly burst: number

  constructor(private readonly options: SlackLimiterOptions) {
    const perTick = Math.ceil((options.requestsPerMinute * BURST_WINDOW_SEC) / 60)
    this.burst = Math.max(1, Math.min(Math.ceil(options.requestsPerMinute), Math.max(MIN_BURST, perTick)))
  }

  /**
   * Takes one request for `key` (one monitor); false defers the poll. A `first` read primes
   * a new monitor, and everything posted before it counts as already seen, so it goes first.
   */
  acquire(token: string, key: string, first = false): boolean {
    const now = this.options.now()
    const budget = this.budget(token, now)
    this.ask(budget, key, now, first)
    if (this.waiting(budget, key, now)) return false

    this.refill(budget, now)
    if (budget.credit < 1 || budget.queue[0] !== key) return false
    budget.queue.shift()
    budget.credit -= 1
    return true
  }

  /** Charges a follow-up page that a read cannot stop before; false while the token waits. */
  charge(token: string): boolean {
    const now = this.options.now()
    const budget = this.budget(token, now)
    if (now < budget.pausedUntil) return false
    this.refill(budget, now)
    budget.credit -= 1
    return true
  }

  /** Takes a follow-up page that a read could stop before, if the budget has one. */
  spend(token: string): boolean {
    const now = this.options.now()
    const budget = this.budget(token, now)
    if (now < budget.pausedUntil) return false
    this.refill(budget, now)
    if (budget.credit < 1) return false
    budget.credit -= 1
    return true
  }

  /** Holds every monitor on `token` until Slack's Retry-After has passed, at most an hour. */
  pause(token: string, retryAfterSec: number, method: string, key: string): void {
    const now = this.options.now()
    const budget = this.budget(token, now)
    const until = now + Math.min(retryAfterSec, MAX_RETRY_AFTER_SEC) * 1000
    if (until <= budget.pausedUntil) return
    if (now >= budget.pausedUntil || !budget.wait) {
      this.finishWait(budget)
      budget.wait = { method, startedAt: now, askedSec: retryAfterSec, first: key, held: new Set([key]), logged: false }
    } else if (!budget.wait.logged) {
      budget.wait.askedSec = Math.max(budget.wait.askedSec, Math.ceil((now - budget.wait.startedAt) / 1000) + retryAfterSec)
    }
    budget.pausedUntil = until
    budget.credit = 0
    budget.refilledAt = until
  }

  private budget(token: string, now: number): TokenBudget {
    let budget = this.budgets.get(token)
    if (!budget) {
      budget = { credit: this.burst, refilledAt: now, pausedUntil: 0, queue: [], waiters: new Map(), seq: 0 }
      this.budgets.set(token, budget)
    }
    return budget
  }

  // True while the token waits out a Retry-After. Counts each monitor held back, and logs
  // the wait once the monitor that hit the limit asks again or the wait is over.
  private waiting(budget: TokenBudget, key: string, now: number): boolean {
    const wait = budget.wait
    if (now >= budget.pausedUntil) {
      this.finishWait(budget)
      return false
    }
    if (wait && !wait.logged) {
      if (key === wait.first) this.logWait(budget, wait)
      else wait.held.add(key)
    }
    return true
  }

  private finishWait(budget: TokenBudget): void {
    if (budget.wait && !budget.wait.logged) this.logWait(budget, budget.wait)
    budget.wait = undefined
  }

  private logWait(budget: TokenBudget, wait: Wait): void {
    wait.logged = true
    const seconds = Math.round((budget.pausedUntil - wait.startedAt) / 1000)
    const clamped = seconds < wait.askedSec ? ` (Slack asked for ${wait.askedSec}s; waits are capped at ${MAX_RETRY_AFTER_SEC}s)` : ""
    const monitors = wait.held.size
    this.options.log(
      `[sourcefed] Slack rate-limited ${wait.method}: waiting ${seconds}s${clamped} before polling ${monitors} Slack monitor${monitors === 1 ? "" : "s"} on this token again`,
    )
  }

  // Every due monitor asks once per runtime tick, in the same order. A waiter that has not
  // asked since this key last asked missed a whole tick, so it stopped (removed, disabled, or
  // moved to a webhook) and must not hold the queue, however long a tick is.
  private ask(budget: TokenBudget, key: string, now: number, first: boolean): void {
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
      if (now - waiter.lastAsked > WAITER_FORGET_MS) budget.waiters.delete(waiting)
    }
    if (first) {
      budget.queue = [key, ...budget.queue.filter((waiting) => waiting !== key)]
    } else if (!budget.queue.includes(key)) {
      budget.queue.push(key)
    }
  }

  private refill(budget: TokenBudget, now: number): void {
    if (now <= budget.refilledAt) return
    const earned = ((now - budget.refilledAt) / 60_000) * this.options.requestsPerMinute
    budget.credit = Math.min(this.burst, budget.credit + earned)
    budget.refilledAt = now
  }
}

/**
 * Reads SOURCEFED_SLACK_REQUESTS_PER_MINUTE: 20 a minute when unset, and at most 50. An
 * invalid or too-high value is reported through `warn` and replaced.
 */
export function slackRequestsPerMinute(
  value = process.env.SOURCEFED_SLACK_REQUESTS_PER_MINUTE,
  warn: (line: string) => void = (line) => console.warn(line),
): number {
  if (value === undefined || value.trim() === "") return DEFAULT_REQUESTS_PER_MINUTE
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    warn(`[sourcefed] SOURCEFED_SLACK_REQUESTS_PER_MINUTE=${JSON.stringify(value)} is not a positive number; using ${DEFAULT_REQUESTS_PER_MINUTE}`)
    return DEFAULT_REQUESTS_PER_MINUTE
  }
  if (parsed > MAX_REQUESTS_PER_MINUTE) {
    warn(`[sourcefed] SOURCEFED_SLACK_REQUESTS_PER_MINUTE=${value} is above Slack's Tier 3 limit; using ${MAX_REQUESTS_PER_MINUTE}`)
    return MAX_REQUESTS_PER_MINUTE
  }
  return parsed
}
