# SourceFed

SourceFed is a tool that solves one problem: how does your agent get notified of changes from different sources like Slack, Jira, or GitHub? This solves it. 
Your agent can independently create monitors that keep up with updates from these sources.

For example, after the agent creates a PR, it can create a monitor that will be notified of CI, reviews, comments, 
merge conflicts, and more. No more copy pasting or reminding the agent to check the PR status.

It's also named after the [SourceFed](https://www.youtube.com/sourcefed) YouTube channel (I used watch them all the time as a kid [RIP])

## Install

```sh
brew install stevenjpx2/tap/sourcefed
```

(`npm install --global @fdcn/sourcefed` installs the same CLI.)

The package ships one artifact with everything:

```text
sourcefed                 CLI (daemon, MCP, monitor management, skills)
@fdcn/sourcefed/core      monitor engine: domain model, poll/webhook transports,
                          cursors, event queues, JSON store
@fdcn/sourcefed/daemon    transport-neutral application service: monitor commands,
                          event reads/acknowledgement, subscriptions, JSON protocol
@fdcn/sourcefed/mcp       the daemon through MCP tools and resource subscriptions
@fdcn/sourcefed/server    OpenCode server plugin (tool registration, guidance)
@fdcn/sourcefed/tui       OpenCode TUI plugin (sidebar, /sourcefed dialogs)
@fdcn/sourcefed/pi        Pi extension
```

Jira, GitHub, and Slack providers are built in; the daemon composes the provider registry
directly. The daemon owns polling, webhook handling, cursors, monitor identity, retries,
and the shared state store. Hosts provide a target identity and an event bridge.

## OpenCode And Pi

Install the plugins in one step:

```sh
sourcefed setup                 # both hosts
sourcefed setup opencode        # or one at a time
sourcefed setup pi
```

`setup` delegates to each host's own installer: `opencode plugin @fdcn/sourcefed@<version> --global` (patches `opencode.json` and `tui.json`) and `pi install npm:@fdcn/sourcefed@<version>`. When a host binary is missing, it prints the manual instructions below.

Manually, OpenCode takes the package in both plugin lists:

```json
// opencode.json
{ "plugin": ["@fdcn/sourcefed@0.2.6"] }
```

```json
// tui.json
{ "plugin": ["@fdcn/sourcefed@0.2.6"] }
```

Pi:

```sh
pi install npm:@fdcn/sourcefed@0.2.6
```

Restart the host after installing. OpenCode resolves the server entrypoint from
`exports["./server"]` and the TUI plugin from `exports["./tui"]`; Pi loads the extension
from the package's `pi` metadata. Both register `monitor_create`/`monitor_list`/
`monitor_status`/`monitor_start`/`monitor_stop` tools, and `/sourcefed` plus
`/sourcefed-logs` dialogs that show per-monitor detail (delivery, poll interval,
created/updated timestamps, last poll, webhook heartbeat).

Without `SOURCEFED_DAEMON_URL`, a host spawns one local HTTP daemon when none is running
and connects to it, so monitors persist across sessions and share one registry.

## Daemon

```sh
sourcefed daemon
```

The HTTP daemon serves `POST /rpc`, `GET /events?target=...` (SSE push), and provider
webhooks at `/webhooks/github` and `/webhooks/slack`. It defaults to
`http://127.0.0.1:18787` (`SOURCEFED_DAEMON_HOST`/`SOURCEFED_DAEMON_PORT`, or `--host`/
`--port`); clients use `SOURCEFED_DAEMON_URL` or `SOURCEFED_DAEMON_PORT`. Binding to a
non-loopback address requires `SOURCEFED_DAEMON_TOKEN`, which clients send as a bearer
token on `/rpc` and `/events`.

When any webhook secret is configured (or `SOURCEFED_ENABLE_WEBHOOKS=1`), the daemon also
starts a webhook-only listener on `SOURCEFED_WEBHOOK_HOST`:`SOURCEFED_WEBHOOK_PORT`
(default `127.0.0.1:8788`). Point a tunnel or reverse proxy at it (e.g. bind `0.0.0.0`) to
receive GitHub/Slack webhooks publicly while RPC and events stay on loopback; webhook
signature (HMAC / Slack signing) authenticates requests, not the daemon token.

## MCP

```sh
sourcefed mcp --http      # MCP at http://127.0.0.1:18788/mcp (SOURCEFED_MCP_PORT)
sourcefed mcp --stdio
```

New events use the current MCP 2026 resource-subscription flow:

1. A host subscribes with `subscriptions/listen` to its `sourcefed://targets/.../events` resource.
2. The daemon publishes `notifications/resources/updated`.
3. The host reads the resource, presents the events, and calls `monitor_events_ack`.

### Adding it to an agent

Point your agent's MCP client at the server with stdio or HTTP. The server owns an
in-process daemon, so `monitor create` through MCP behaves exactly like the CLI.

Claude Code (`.mcp.json`):

```json
{
  "mcpServers": {
    "sourcefed": { "command": "sourcefed", "args": ["mcp", "--stdio"] }
  }
}
```

opencode (`opencode.json`):

```json
{
  "mcp": {
    "sourcefed": { "type": "local", "command": ["sourcefed", "mcp", "--stdio"], "enabled": true }
  }
}
```

A shared HTTP server works for any client that supports remote MCP: start
`sourcefed mcp --http` once, then point clients at `http://127.0.0.1:18788/mcp`.

## CLI

```sh
sourcefed monitor create --source-type jira --issue-key ADEPT-43742 --name ADEPT-43742
sourcefed monitor create --source-type github --repo owner/name --pr-number 42 --name pr-42
sourcefed monitor create --source-type slack --thread-url https://myteam.slack.com/archives/C0123/p1700000000000000
sourcefed monitor list
sourcefed monitor status --id MONITOR_ID
sourcefed monitor events
sourcefed monitor follow       # live tail of new events (SSE); Ctrl+C to stop
sourcefed monitor ack --event-id EVENT_ID
sourcefed monitor stop --id MONITOR_ID
sourcefed monitor start --id MONITOR_ID
sourcefed monitor remove --id MONITOR_ID --yes
sourcefed monitor sources
```

Monitors belong to a target; the CLI defaults to `--target-kind cli` and `--target-id`
`$SOURCEFED_TARGET_ID` (falling back to the hostname), so list/status/stop only see
monitors created for that target. Slack accepts `--thread-url` or `--channel-id` +
`--thread-ts`; `--poll-interval-sec` (min 15) tunes polling. Set `SOURCEFED_DAEMON_URL`
when the daemon is not at the default URL.

### Getting events without MCP

Agents that don't integrate MCP can read events straight from the CLI:

```sh
# snapshot of queued events
sourcefed monitor events

# live tail — blocks and prints each new event as it arrives
sourcefed monitor follow

# acknowledge what you consumed so the next read starts clean
sourcefed monitor ack --event-id EVENT_ID
```

`follow` drains the queued events first, then prints live ones over SSE. Pipe its
stdout into a loop, a file, or the agent's own reader.

### Skills

The CLI bundles skills that teach agents how to use sourcefed, served in the agent-browser
style: a thin discovery stub plus CLI-served content that always matches the installed version.

```sh
sourcefed skills            # list available skills
sourcefed skills get core   # load the core usage guide
sourcefed skills get core --full
sourcefed skills path core
```

Set `SOURCEFED_SKILLS_DIR` to override the bundled skills directory.

## Configuration

Copy `.env.example` to a secure environment configuration and set only the integrations you
use:

- **Jira** — requires `SOURCEFED_JIRA_BASE_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_KEY`.
- **GitHub / Slack webhooks** — optional `SOURCEFED_GITHUB_WEBHOOK_SECRET` /
  `SOURCEFED_SLACK_SIGNING_SECRET`. With them, monitors prefer webhook delivery and fall
  back to polling when the webhook goes quiet; without them they poll.
- **GitHub polling** — `GH_TOKEN` or `GITHUB_TOKEN` (without one, GitHub monitors do not
  poll). Calls the REST and GraphQL APIs directly.
- **Slack polling** — `SOURCEFED_SLACK_TOKEN` (bot or user token). Reads and notifies only;
  never sends messages. The bot must be a member of the channel or DM it monitors.

State:

- The JSON store defaults to `$XDG_STATE_HOME/sourcefed` or `~/.local/state/sourcefed`;
  override with `SOURCEFED_STATE_DIR`.
- One daemon owns a state dir at a time (a lock file guards it); adapters reuse an
  already-running daemon instead of spawning another.
- A new monitor's first successful poll primes history: existing comments, reviews, and
  messages are recorded silently; only activity after that point is delivered as events.

## Development

```sh
npm install
npm run check
```

`npm run check` builds the workspace bundles and the public package, builds the test
bundles, runs the suite under `node --test`, and typechecks.

### Integration Tests

`npm run integration` packs every workspace package, installs the tarballs into an isolated
consumer project, and runs real-life scenarios against the installed artifacts:

- **core / daemon / cli / mcp** — store/queue/lock behavior, daemon lifecycle with event
  delivery, the installed binary driving a live daemon, and the 2026 resource-subscription
  flow against a real MCP HTTP server
- **provider-\*** — each provider polling against mocked upstreams through a live daemon tick
- **public-package** — the aggregate tarball alone: subpath imports, the npm-created bin,
  daemon + RPC, no TypeScript in `dist`
- **opencode / pi adapters** — run in their real hosts when available: headless `opencode
  run` with the plugin installed and a temp state dir, and Pi RPC mode loading the
  extension directly (each skips when its host is unavailable)

Releases follow [docs/e2e-release-plan.md](./docs/e2e-release-plan.md): the exact tarball
that publishes is tested with no private workspace packages installed, every scenario must
pass with zero skips, and registry canaries gate config and tap updates.

Monitor state is intentionally ignored by Git. Never commit Jira keys, repository names,
Slack URLs, session IDs, webhook payloads, or credentials in tests and examples.

## License

MIT. See [LICENSE](./LICENSE).
