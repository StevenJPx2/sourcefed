# sourcefed — monitoring guidance

sourcefed is a monitor service. It lets you create **monitors** that watch a Jira issue, GitHub
PR, or Slack thread and route NEW events into the host session where the monitor was created.
The OpenCode and Pi adapters use the Sourcefed MCP server for monitor tools and event delivery.

## When to create a monitor

- **You found or are working on a Jira ticket** → create a Jira monitor for its issue key. You
  will be notified of new comments, description edits, and summary/status/assignee/priority/label changes.
- **You are on a branch with an active PR (or just opened one)** → create a GitHub monitor for
  `repo#prNumber`. You will be notified of new reviews (including bot reviews), PR and
  line-level comments, CI failures, merge conflicts, and the PR being merged or closed.
- **You were given a Slack thread** → create a Slack monitor for the thread URL. It is
  detect-only: it reads new messages and routes notifications into this session, but never replies.

## How to create one

Use the `monitor_create` tool:

- Jira: `monitor_create({ name: "<key>", sourceType: "jira", issueKey: "PROJ-12345" })`
- GitHub: `monitor_create({ name: "<pr>", sourceType: "github", repo: "owner/name", prNumber: 42 })`
- Slack: `monitor_create({ name: "<thread>", sourceType: "slack", threadUrl: "<slack-thread-url>" })`

GitHub and Slack use webhook delivery when configured and fall back to polling when unavailable.
Jira always uses polling. Slack monitors are
always detect-only and never reply. You can lower
`pollIntervalSec` (min 15) for time-sensitive work, but prefer the default to avoid hammering APIs.
Actionable events trigger an agent turn. Stable all-passing CI is suppressed to avoid notification noise; other informational events are added as context only.

The abstract `Monitor` consolidates transport fallback and recovery and composes whichever
generic `PollMonitor` and `WebhookMonitor` transports a source exposes as class attributes.
Each source is isolated in its own directory: `jira/`, `github/`, and `slack/`, with monitor and
event modules. Jira exposes only polling; GitHub and Slack expose both. Do not add source-specific
transport branches to tools or scheduling.

## Lifecycle

- Monitors belong to the target that created them; list, status, and stop only affect that target's monitors.
- `monitor_list` — see monitors created by this session.
- `monitor_status { id }` — detail on one of this session's monitors.
- `monitor_stop { id }` — stop routing events for one of this session's monitors.
- GitHub monitors remove themselves after the PR is merged. Jira monitors remove themselves when
  `SOURCEFED_JIRA_TERMINAL_STATUS` matches the issue status; leave it unset to disable automatic Jira removal.

## When an event arrives

Events are fed into your session as a message (e.g. a new review comment, a CI failure, a Jira
status change). Treat it like any new input: read it, decide whether it needs action, and act
(or tell the user it needs a decision). If the event is non-actionable (e.g. CI all-passing),
acknowledge it and move on — do not fabricate work from it.
