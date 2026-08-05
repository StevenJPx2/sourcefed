# Sourcefed command reference

## CLI

```text
sourcefed daemon [--port 18787]       Run the shared daemon (rpc, events, webhooks)
sourcefed mcp --stdio                       Serve MCP over stdio
sourcefed mcp --http [--port 18788]          Serve MCP over HTTP at /mcp
sourcefed monitor create [options]          Create a monitor via a running daemon
sourcefed monitor list [--target-kind KIND] [--target-id ID]
sourcefed monitor status --id ID [--target-kind KIND] [--target-id ID]
sourcefed monitor stop --id ID [--target-kind KIND] [--target-id ID]
sourcefed monitor start --id ID [--target-kind KIND] [--target-id ID]
sourcefed monitor events [--target-kind KIND] [--target-id ID]
sourcefed monitor ack --event-id ID[,ID...] [--target-kind KIND] [--target-id ID]
sourcefed skills [list]                     List bundled skills
sourcefed skills get <name> [--full]        Output skill content (--full adds references)
sourcefed skills get --all                  Output every skill
sourcefed skills path [name]                Print skill directory path
```

### monitor create options

```text
--name NAME           Human-readable monitor name (defaults to the source type)
--source-type TYPE    jira | github | slack
--issue-key KEY       Jira issue key (jira)
--repo OWNER/NAME     GitHub repository (github)
--pr-number N         GitHub PR number (github)
--channel-id ID       Slack channel (slack)
--thread-ts TS        Slack parent message timestamp (slack)
--thread-url URL      Slack thread URL (slack)
--poll-interval-sec N Poll interval in seconds (min 15)
--target-kind KIND    Target kind for ownership scoping (default: cli)
--target-id ID        Target id for ownership scoping (default: hostname)
```

## Environment

```text
SOURCEFED_DAEMON_URL            Base URL of a shared daemon (default http://127.0.0.1:18787).
                                When unset, adapters auto-spawn one local HTTP daemon.
SOURCEFED_DAEMON_TOKEN          Bearer token required when binding a non-loopback host
SOURCEFED_SLACK_TOKEN           Slack bot/user token for direct Slack Web API polling
SOURCEFED_STATE_DIR             State directory (default ~/.local/state/sourcefed)
SOURCEFED_DAEMON_PORT           HTTP daemon port (default 18787)
SOURCEFED_MCP_PORT              MCP HTTP port (default 18788)
SOURCEFED_WEBHOOK_PORT          Optional webhook listener port (default 8788)
SOURCEFED_JIRA_BASE_URL         Jira base URL (default https://<site>.atlassian.net)
SOURCEFED_JIRA_TERMINAL_STATUS  Jira status that auto-removes monitors
GH_TOKEN / GITHUB_TOKEN         GitHub token for direct API polling
SOURCEFED_GITHUB_WEBHOOK_SECRET GitHub webhook secret (enables webhooks)
SOURCEFED_SLACK_SIGNING_SECRET  Slack signing secret (enables webhooks)
SOURCEFED_SKILLS_DIR            Override the bundled skills directory
```

## Daemon protocol

The daemon speaks a small JSON protocol over HTTP (`POST /rpc`, `GET /events?target=...`
for SSE). Any harness can talk to it directly:

```json
{ "id": 1, "method": "monitor.create", "params": { ... } }
{ "id": 1, "result": { ... } }
```

```text
data: { "type": "event", "target": { "kind": "...", "id": "..." }, "events": [ ... ] }
```

Methods: `monitor.create`, `monitor.list`, `monitor.status`, `monitor.stop`,
`monitor.events`, `monitor.ack`, `monitor.subscribe`, `monitor.unsubscribe`,
`daemon.sourceTypes`.
