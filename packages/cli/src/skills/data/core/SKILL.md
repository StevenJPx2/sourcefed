---
name: core
description: Core sourcefed usage guide. Read this before creating monitors. Covers monitor creation per source (Jira issue, GitHub PR, Slack thread, Yab feed), event delivery and acknowledgement semantics, daemon modes, CLI usage, and troubleshooting. Use when the user asks to watch or monitor a Jira ticket, GitHub PR, Slack thread, a feed or inbox they are signed in to in Yab, or when sourcefed monitor events arrive in the session.
---

# Sourcefed core

Sourcefed lets you create **monitors** that watch a Jira issue, GitHub PR,
Slack thread or direct-message conversation, or a feed read through Yab, and route NEW events into the session you're currently working in,
so you can react to them as they happen.

Every monitor is detect-only: it routes events into the session and never
replies to the watched thread unless you are explicitly asked to.

## Create a monitor

Monitors belong to the session that created them; list, status, and stop only
affect that session's monitors. `source` is one source, chosen by its `type`, with
only that source's fields.

- **Jira issue**: `monitor_create({ name: "PROJ-12345", source: { type: "jira", issueKey: "PROJ-12345" } })`
- **GitHub PR**: `monitor_create({ name: "PR #42", source: { type: "github", repo: "owner/repo", prNumber: 42 } })`
- **Jira issues matching JQL**: `monitor_create({ name: "agent", source: { type: "jira-query", jql: "project = PROJ AND labels = agent" } })`
- **GitHub issues with labels**: `monitor_create({ name: "build", source: { type: "github-issues", repo: "owner/repo", labels: ["agent:build"] } })`
- **Schedule**: `monitor_create({ name: "nightly", source: { type: "schedule", cron: "0 2 * * *", job: "nightly-audit", timezone: "Asia/Kolkata" } })`
- **Slack thread**: `monitor_create({ name: "thread", source: { type: "slack", threadUrl: "<thread-url>" } })`
- **Whole Slack DM**: `monitor_create({ name: "DM with Alex", source: { type: "slack", channelId: "D0123456789" } })`
- **Yab feed**: `monitor_create({ name: "inbox", source: { type: "yab", url: "https://mail.google.com/mail/u/0/feed/atom", space: "Personal", match: "interview|offer", exclude: "newsletter" } })`

You will be notified of:

- **Jira**: new comments, description edits, and summary/status/assignee/priority/label changes.
- **GitHub**: new reviews (including bot reviews), PR and line-level comments,
  CI failures, merge conflicts, and the PR being merged or closed.
- **Jira query**: `item.matched` when an issue starts matching the JQL, `item.unmatched` when
  it stops. The first poll is silent unless `includeExisting`.
- **GitHub issues**: `item.matched` when an open issue starts carrying every label (and
  matches `assignee`, `author` or `query`), `item.unmatched` when it stops or closes. The
  first poll is silent unless `includeExisting`.
- **Schedule**: `schedule.fired` at each cron time; times that came while sourcefed was
  stopped or the Mac slept arrive as one `schedule.missed` with the latest time and a
  `missed` count. It never decides whether the work runs.
- **Slack thread**: new replies in the thread.
- **Slack DM**: new top-level messages in the DM. Slack monitors are always detect-only
  and never reply.
- **Yab feed**: each new entry of an Atom, RSS or JSON feed, read through the user's Yab
  browser with their sign-ins (so private feeds like Gmail's unread-inbox feed work).
  `space` picks the Yab space; `match`/`exclude` are case-insensitive regexes over the
  entry's title, summary and author. Yab must be running.

GitHub and Slack use webhook delivery when configured and fall back to polling
when unavailable. Jira and Yab always use polling. You can lower `pollIntervalSec`
(min 15) for time-sensitive work, but prefer the default to avoid hammering
APIs.

Actionable events trigger an agent turn. Stable all-passing CI is suppressed to
avoid notification noise; other informational events are added as context only.

## Lifecycle

- `monitor_list` — see monitors created by this session.
- `monitor_status { id }` — detail on one of this session's monitors.
- `monitor_stop { id }` — stop routing events for one of this session's monitors.
- GitHub monitors remove themselves after the PR is merged. Jira monitors
  remove themselves when `SOURCEFED_JIRA_TERMINAL_STATUS` matches the issue
  status; leave it unset to disable automatic Jira removal.

## When an event arrives

Events are fed into your session as a message (e.g. a new review comment, a CI
failure, a Jira status change). Treat it like any new input: read it, decide
whether it needs action, and act (or tell the user it needs a decision). If the
event is non-actionable (e.g. CI all-passing), acknowledge it and move on — do
not fabricate work from it.

## Daemon and CLI

Sourcefed runs as a shared HTTP daemon (`@sourcefed/daemon`) that owns
polling, webhooks, cursors, and state. The MCP server, the CLI, and host
adapters (OpenCode, Pi) are all consumers of the daemon.

- `sourcefed daemon [--port 18787]` — run the shared daemon (rpc, events, webhooks).
- `sourcefed mcp --stdio|--http` — expose the daemon through MCP.
- `sourcefed monitor create|list|status|stop` — drive a running daemon from the shell.
- `sourcefed monitor follow` — tail new events live over SSE (drains queued events first);
  use `sourcefed monitor events` for a one-shot snapshot and `monitor ack` to consume them.

Without MCP, read events from the CLI:

```bash
sourcefed monitor follow &            # stream events in the background
sourcefed monitor events              # or take a snapshot of what's queued
sourcefed monitor ack --event-id $ID  # acknowledge what you consumed
```

When `SOURCEFED_DAEMON_URL` is unset, the OpenCode and Pi adapters spawn one
local HTTP daemon automatically (if none is running) and connect to it, so
monitors persist across sessions and share a single registry.

Load the full command reference with `sourcefed skills get core --full`.
