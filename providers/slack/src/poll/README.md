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

```mermaid
flowchart LR
  tick[runtime tick] --> due{monitor due?}
  due -- yes --> grant{budget grants a request?}
  grant -- no --> deferred[deferred: cursor and stamps unchanged, due again next tick]
  grant -- yes --> call[call Slack]
  call -- 429 Retry-After --> pause[pause the token for every monitor, log one line] --> deferred
  call -- ok --> read[parse against the cursor, deliver events]
```

- A deferred poll is not a failure: nothing is logged, the monitor does not show as
  unresponsive, and the next granted poll reads from the same cursor.
- Monitors refused a request wait in arrival order. One that stops asking (removed,
  disabled, moved to a webhook) is dropped once it has missed a whole tick and been
  silent for 15 seconds.
- Requests refill at the budget's rate, with a burst of about one 5-second tick's worth
  (at least two).
- A read that needs more pages than the first: a thread's further pages wait for budget,
  and a poll cut short keeps what it read and continues next time, since replies come
  oldest first. A DM's further pages go at once, since its history comes newest first,
  and later polls on the token wait to pay them back.
- A `users.list` rate limit waits on its own; polls keep using the cached list.

```ts
const limiter = new SlackRateLimiter({ requestsPerMinute: 20, now: () => Date.now(), log: console.warn })
if (limiter.acquire(token, monitorId)) {
  // call Slack; on a 429:
  limiter.pause(token, retryAfterSec, "conversations.replies")
}
```
