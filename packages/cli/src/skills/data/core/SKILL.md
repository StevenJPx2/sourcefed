---
name: core
description: Core sourcefed usage guide. Read this before creating monitors. Covers monitor creation per source (Jira issue, GitHub PR, Slack thread), event delivery and acknowledgement semantics, daemon modes, CLI usage, and troubleshooting. Use when the user asks to watch or monitor a Jira ticket, GitHub PR, Slack thread, or when sourcefed monitor events arrive in the session.
---

# Sourcefed core

Sourcefed lets you create **monitors** that watch a Jira issue, GitHub PR, or
Slack thread and route NEW events into the session you're currently working in,
so you can react to them as they happen.

Every monitor is detect-only: it routes events into the session and never
replies to the watched thread unless you are explicitly asked to.

## Create a monitor

Monitors belong to the session that created them; list, status, and stop only
affect that session's monitors.

- **Jira issue**: `monitor_create({ name: "PROJ-12345", sourceType: "jira", issueKey: "PROJ-12345" })`
- **GitHub PR**: `monitor_create({ name: "PR #42", sourceType: "github", repo: "owner/repo", prNumber: 42 })`
- **Slack thread**: `monitor_create({ name: "thread", sourceType: "slack", threadUrl: "<thread-url>" })`

You will be notified of:

- **Jira**: new comments, description edits, and summary/status/assignee/priority/label changes.
- **GitHub**: new reviews (including bot reviews), PR and line-level comments,
  CI failures, merge conflicts, and the PR being merged or closed.
- **Slack**: new replies in the thread. Slack monitors are always detect-only
  and never reply.

GitHub and Slack use webhook delivery when configured and fall back to polling
when unavailable. Jira always uses polling. You can lower `pollIntervalSec`
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
