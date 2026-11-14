# Slack polling

Polling reads a Slack thread with `conversations.replies`, or a whole DM with
`conversations.history`, and turns messages the cursor has not seen into events. Once a
monitor is primed, each poll asks only for messages after the newest it has seen.

| Module | Does |
| --- | --- |
| `monitor.ts` | `slackPollMonitor`: the `PollMonitor` that runs one poll and maps events |
| `utils/poll-slack.ts` | `pollSlack`: reads the source after the cursor, then parses it |
| `utils/slack-api.ts` | Calls Slack, keeps one hourly `users.list` per token, and takes requests from the token's budget |
| `utils/slack-limiter.ts` | `SlackRateLimiter`: one request budget per token, served in turn, paused by `Retry-After` |
| `utils/parse-slack-read-result.ts` | Finds new messages and advances the cursor |

## Rate limits

Slack limits each method per workspace per app. `conversations.replies` and
`conversations.history` are Tier 3 (50+ a minute) for internal apps. Every monitor on one
`SOURCEFED_SLACK_TOKEN` shares one budget, 20 requests a minute by default
(`SOURCEFED_SLACK_REQUESTS_PER_MINUTE`, read when the daemon starts).

| Setting | Effect |
| --- | --- |
| unset | 20 a minute |
| `1` | for commercially distributed apps outside the Marketplace, which Slack limits to 1 request a minute and 15 messages a page |
| above 50 | capped at 50 with a warning: the budget covers both methods, and Tier 3 promises each only 50 |
| not a positive number | 20, with a warning |

Each monitor polls about every `max(pollIntervalSec, monitors × 60 / budget)` seconds:
about 100s with 32 monitors at the default budget, and 200s with 64.

```mermaid
flowchart LR
  tick[runtime tick] --> due{monitor due?}
  due -- yes --> grant{budget grants a request?}
  grant -- no --> deferred[deferred: cursor and stamps unchanged, due again next tick]
  grant -- yes --> call[call Slack]
  call -- 429 Retry-After --> pause[pause the token for every monitor] --> deferred
  call -- ok --> read[parse against the cursor, deliver events]
```

- A deferred poll is not a failure: nothing is logged, and the next granted poll reads from
  the same cursor. The monitor does not show as unresponsive while it waits, unless its
  last read is more than ten of its unresponsive windows old (and at least 15 minutes).
- A wait lasts Slack's `Retry-After`, at most an hour. It is logged once, after every
  monitor it holds back has asked (a whole tick later) or when it ends, naming how long it
  is and how many monitors it held back.
- Monitors refused a request wait in arrival order. A monitor's first read goes to the head
  of the queue, since it primes the cursor and everything posted before it counts as seen.
  One that stops asking (removed, disabled, moved to a webhook) is dropped once it has
  missed a whole tick and been silent for 15 seconds.
- Requests refill at the budget's rate, with a burst of about one 5-second tick's worth
  (at least three), so a busy token uses its whole budget.
- A primed thread's further pages wait for budget, and a poll cut short keeps what it read
  and continues next time, since replies come oldest first. Any other read must finish: a
  DM's history comes newest first, and priming must reach the newest message. Its pages go
  at once, later polls on the token pay them back, and a rate limit or a wait started by
  another poll defers the whole read.
- A `users.list` rate limit waits on its own; polls keep using the cached list.

### Known limits

- A monitor created during a wait primes after it, so messages posted during the wait count
  as already seen.
- At 1 request a minute, a DM read needing pages Slack keeps refusing is deferred whole
  every time, so it never completes until the limit eases.
- Waits use the wall clock and live in memory: a clock step changes them, and a daemon
  restart forgets them.
- A monitor that is granted and polls again later joins the back of the queue.

```ts
const limiter = new SlackRateLimiter({ requestsPerMinute: 20, now: () => Date.now(), log: console.warn })
if (limiter.acquire(token, monitorId)) {
  // call Slack; on a 429:
  limiter.pause(token, retryAfterSec, "conversations.replies", monitorId)
}
```
