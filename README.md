# SourceFed

SourceFed, is a tool that solves one problem: how does your agent get notified of changes from different sources like Slack, Jira, or GitHub? This solves it. Your agent can independently create monitors that keep up with updates from these sources.

For example, after the agent creates a PR, it can create a monitor that will be notified of CI, reviews, comments, merge conflicts, and more. No more copy pasting or reminding the agent to check the PR status.

It's also named after the [SourceFed](https://www.youtube.com/sourcefed) YouTube channel (I used watch them all the time as a kid [RIP]),

## Architecture

```text
Pi / OpenCode / CLI
        | daemon client (stdio or HTTP JSON protocol)
        v
Sourcefed daemon (@sourcefed/daemon)
        |          ^
        |          +-- @sourcefed/mcp (one presentation of the daemon)
        | @sourcefed/core (monitor engine, transports, JSON storage, SDK)
        v
Jira / GitHub / Slack providers (@sourcefed/provider-*)
```

Each package stands on its own:

- **`@sourcefed/core`**: the monitor engine: domain model, poll/webhook transports,
  cursors, event queues, and the JSON store. Use it as an SDK in any runtime.
- **`@sourcefed/provider-{jira,github,slack}`**: independent provider packages under
  `providers/`. A provider can live in its own repository; anything implementing the same
  monitor contract plugs in. The daemon composes the built-in registry (`SOURCE_MAP`) by
  importing the three provider packages directly.
- **`@sourcefed/daemon`**: a transport-neutral application service over core + providers:
  monitor commands, event reads/acknowledgement, subscriptions, and a small JSON protocol
  over stdio or HTTP. The MCP server, CLI, and host adapters are all daemon consumers.
- **`@sourcefed/mcp`**: exposes the daemon through MCP tools and modern 2026 resource
  subscriptions for event push.
- **`@sourcefed/cli`**: the `sourcefed` binary: runs the daemon (`daemon`),
  serves MCP (`mcp --stdio|--http`), manages monitors from the shell, and bundles skills
  served via `sourcefed skills get` (agent-browser style).
- **`@sourcefed/opencode`**, **`@sourcefed/pi`**: host adapters that drive the daemon client
  directly and route events into their sessions.

The daemon owns polling, webhook handling, cursors, monitor identity, retries, and the shared
state store. Hosts only provide a target identity and an event presentation bridge.

## Install

```sh
git clone https://github.com/StevenJPx2/sourcefed.git ~/.config/opencode/plugins/sourcefed
cd ~/.config/opencode/plugins/sourcefed
npm install
```

The CLI builds to a single Node bundle (`packages/cli/dist/index.js`) with esbuild. The daemon,
CLI, adapters, and tests all run on Node natively.

## Daemon

Start a shared local HTTP daemon:

```sh
sourcefed daemon
```

The HTTP daemon serves `POST /rpc`, `GET /events?target=...` (SSE push), and provider
webhooks at `/webhooks/github` and `/webhooks/slack`. It defaults to
`http://127.0.0.1:18787` (`SOURCEFED_DAEMON_HOST`/`SOURCEFED_DAEMON_PORT`, or `--host`/
`--port`); configure clients with `SOURCEFED_DAEMON_URL` or `SOURCEFED_DAEMON_PORT`. When
neither is set, the OpenCode and Pi adapters spawn one local HTTP daemon automatically (if
none is running) and connect to it, so monitors persist across sessions and share a single
registry. Binding to a non-loopback address requires `SOURCEFED_DAEMON_TOKEN`, which
clients then send as a bearer token on `/rpc` and `/events`.

When any webhook secret is configured (or `SOURCEFED_ENABLE_WEBHOOKS=1`), the daemon also
starts a separate webhook-only listener on `SOURCEFED_WEBHOOK_HOST`:`SOURCEFED_WEBHOOK_PORT`
(default `127.0.0.1:8788`). Point a tunnel or reverse proxy at it (e.g. bind `0.0.0.0`) to
receive GitHub/Slack webhooks publicly while RPC and events stay on loopback; requests are
authenticated by webhook signature (HMAC / Slack signing), not the daemon token.

## MCP

Serve the daemon through MCP:

```sh
sourcefed mcp --http      # MCP at http://127.0.0.1:18788/mcp (SOURCEFED_MCP_PORT)
sourcefed mcp --stdio
```

New events use the current MCP 2026 resource-subscription flow:

1. A host subscribes with `subscriptions/listen` to its `sourcefed://targets/.../events` resource.
2. The daemon publishes `notifications/resources/updated`.
3. The host reads the resource, presents the events, and calls `monitor_events_ack`.

## CLI

Manage monitors against a running daemon:

```sh
sourcefed monitor create --source-type jira --issue-key ADEPT-43742 --name ADEPT-43742
sourcefed monitor create --source-type github --repo owner/name --pr-number 42 --name pr-42
sourcefed monitor create --source-type slack --thread-url https://myteam.slack.com/archives/C0123/p1700000000000000
sourcefed monitor list
sourcefed monitor status --id MONITOR_ID
sourcefed monitor events
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

## OpenCode And Pi

The OpenCode plugin drives the daemon client for every monitor tool. Without
`SOURCEFED_DAEMON_URL`, it spawns one local HTTP daemon (if none is running) and
connects to it, sharing a single monitor registry with other hosts. Set the
variable to point at a specific daemon.

The Pi extension follows the same rule and registers `sourcefed_monitor_*` tools plus a
`/sourcefed` command.

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

`npm run check` builds the workspace bundles, builds the test bundles, runs the suite under
`node --test`, and typechecks. The bundled CLI is at `packages/cli/dist/index.js`.

### Integration Tests

`npm run integration` packs every workspace package, installs the tarballs into an isolated
consumer project, and runs real-life scenarios against the installed artifacts:

- **core** — store/queue/lock behavior
- **daemon** — lifecycle with event delivery
- **cli** — the installed binary driving a live daemon
- **mcp** — the 2026 resource-subscription flow against a real MCP HTTP server
- **provider-\*** — each provider polling against mocked upstreams through a live daemon tick
- **opencode / pi adapters** — run in their real hosts when available: headless `opencode
  run` with the plugin installed and a temp state dir, and Pi RPC mode loading the
  extension directly (each skips when its host is unavailable)

The repository includes an optional OpenCode pull-request review workflow at
`.github/workflows/opencode-review.yml`. Add an `OPENCODE_API_KEY` Actions secret before
enabling it.

Monitor state is intentionally ignored by Git. Never commit Jira keys, repository names,
Slack URLs, session IDs, webhook payloads, or credentials in tests and examples.

## License

MIT. See [LICENSE](./LICENSE).
