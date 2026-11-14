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

Slack limits each method per app per workspace, so anything else using the same Slack
app (another sourcefed daemon, a script, an integration) shares the limit.
`conversations.replies` and `conversations.history` are Tier 3 (50+ a minute) for
internal apps. Every monitor on one `SOURCEFED_SLACK_TOKEN` shares one budget, 20
requests a minute by default (`SOURCEFED_SLACK_REQUESTS_PER_MINUTE`, read when the daemon
starts).

| Setting | Effect |
| --- | --- |
| unset | 20 a minute |
| `1` | for commercially distributed apps outside the Marketplace, which Slack limits to 1 request a minute and 15 messages a page |
| above 45 | capped at 45 with a warning: with its burst of 5, no minute starts more than Tier 3's 50 reads |
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
  last read is more than ten of its unresponsive windows old: 30 minutes for a 60-second
  interval.
- A wait lasts Slack's `Retry-After`, at most an hour. It is logged once, after the
  monitor that hit the limit asks again (a whole tick later) or when the wait ends, naming
  how long it is and how many monitors on the token it holds back.
- Monitors refused a request wait in arrival order. A new monitor's first read waits for
  credit like any other, but goes to the head of the queue, since it primes the cursor and
  everything posted before it counts as seen. Only the first grant goes ahead: a monitor
  whose priming read fails, or that stays unprimed, then waits its turn.
- A monitor that stops asking (removed, disabled, moved to a webhook) is dropped from the
  queue once it has missed a whole tick and been silent for 15 seconds.
- Requests refill at the budget's rate. The burst holds one 5-second tick's credit plus
  one, and at least three, so a token polled every tick uses its whole budget. A runtime
  that ticks less often (a larger `pollLoopSec`) earns more per tick than the burst holds,
  and the rest is not used.
- A primed thread's further pages wait for budget, and a poll cut short keeps what it read
  and continues next time, since replies come oldest first. Any other read must finish: a
  DM's history comes newest first, and priming must reach the newest message. Its pages go
  at once, later polls on the token pay them back, and a rate limit or a wait started by
  another poll defers the whole read. Those pages can take a minute past the budget.
- A `users.list` rate limit waits on its own; polls keep using the cached list.

### Known limits

- A monitor created during a wait primes after it, so messages posted during the wait count
  as already seen.
- At a budget of 1, a read needing more than one page never completes while Slack keeps
  refusing its pages: a DM, or priming a thread with more than 15 replies (15 a page).
- At a budget of 1, more than about 30 monitors on a token take longer than the grace to
  come round, so monitors show as unresponsive while they wait.
- A wait extended after its line is written is not logged again, and a wait shorter than a
  tick is logged after it ended.
- Waits use the wall clock and live in memory: a clock step changes them, and a daemon
  restart forgets them.
- A monitor that is granted and polls again later joins the back of the queue.

```ts
const limiter = new SlackRateLimiter({ requestsPerMinute: 20, now: () => Date.now(), log: console.warn })

if (limiter.acquire(token, monitorId, first)) {
  // call Slack; on a 429:
  limiter.pause(token, retryAfterSec, "conversations.replies", monitorId)
}
```
