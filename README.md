# Sourcefed

Sourcefed is a host-independent monitor engine for Jira issues, GitHub pull requests, and
Slack threads. It is detect-only: it never replies to Jira, GitHub, or Slack. The same core is
available through a daemon, an MCP server, a CLI, a Pi extension, and an OpenCode plugin.

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

- **`@sourcefed/core`** — the monitor engine: domain model, poll/webhook transports,
  cursors, event queues, and the JSON store. Use it as an SDK in any runtime.
- **`@sourcefed/provider-{jira,github,slack}`** — independent provider packages under
  `providers/`. A provider can live in its own repository; anything implementing the same
  monitor contract plugs in. The daemon composes the built-in registry (`SOURCE_MAP`) by
  importing the three provider packages directly.
- **`@sourcefed/daemon`** — a transport-neutral application service over core + providers:
  monitor commands, event reads/acknowledgement, subscriptions, and a small JSON protocol
  over stdio or HTTP. The MCP server, CLI, and host adapters are all daemon consumers.
- **`@sourcefed/mcp`** — exposes the daemon through MCP tools and modern 2026 resource
  subscriptions for event push.
- **`@sourcefed/cli`** — the `sourcefed` binary: runs the daemon (`daemon --http`),
  serves MCP (`mcp --stdio|--http`), manages monitors from the shell, and bundles skills
  served via `sourcefed skills get` (agent-browser style).
- **`@sourcefed/opencode`**, **`@sourcefed/pi`** — host adapters that drive the daemon client
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
CLI, adapters, and tests all run on Node natively; no Bun runtime is required.

## Daemon

Start a shared local HTTP daemon:

```sh
sourcefed daemon --http
```

The HTTP daemon serves `POST /rpc`, `GET /events?target=...` (SSE push), and provider
webhooks. It defaults to `http://127.0.0.1:18787`; configure clients with
`SOURCEFED_DAEMON_URL`. When that variable is unset, the OpenCode and Pi adapters spawn
one local HTTP daemon automatically (if none is running) and connect to it, so monitors
persist across sessions and share a single registry.

## MCP

Serve the daemon through MCP:

```sh
sourcefed mcp --http      # MCP at http://127.0.0.1:18787/mcp
sourcefed mcp --stdio
```

New events use the current MCP 2026 resource-subscription flow:

1. A host subscribes with `subscriptions/listen` to its `sourcefed://targets/.../events` resource.
2. The daemon publishes `notifications/resources/updated`.
3. The host reads the resource, presents the events, and calls `monitor_events_ack`.

## CLI

Manage monitors against a running daemon:

```sh
sourcefed monitor list --target-id my-terminal
sourcefed monitor create --source-type jira --issue-key ADEPT-43742 --name ADEPT-43742
sourcefed monitor status --id MONITOR_ID
sourcefed monitor stop --id MONITOR_ID
```

Set `SOURCEFED_DAEMON_URL` when the daemon is not at the default URL.

## Skills

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
use. Jira requires `SOURCEFED_JIRA_BASE_URL`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_API_KEY`.
GitHub and Slack webhook secrets are optional; without them those sources use polling.

The JSON store defaults to `$XDG_STATE_HOME/sourcefed` or `~/.local/state/sourcefed`. The HTTP
daemon also accepts provider webhooks at `/webhooks/github` and `/webhooks/slack`.

GitHub polling calls the GitHub REST and GraphQL APIs directly, authenticated with
`GH_TOKEN` or `GITHUB_TOKEN`. Slack polling calls the Slack Web API directly, authenticated
with `SOURCEFED_SLACK_TOKEN` (a bot or user token with read access to the target channels).
Slack monitors read and notify only; they do not send messages.

## Development

```sh
npm install
npm run check
```

`npm run check` builds the workspace bundles, builds the test bundles, runs the suite under
`node --test`, and typechecks. The bundled CLI is at `packages/cli/dist/index.js`.

### Integration tests

`npm run integration` packs every workspace package with `npm pack`, installs the tarballs
into an isolated consumer project, and runs real-life scenarios against the installed
artifacts: store/queue/lock behavior (core), the daemon lifecycle with event delivery
(daemon), the installed CLI binary driving a live daemon (cli), the MCP 2026
resource-subscription flow against a real MCP HTTP server (mcp), and each provider polling
against mocked upstreams through a live daemon tick (provider-*). The adapter scenarios
run in their real hosts when available: headless `opencode run` with the plugin installed
and a temp state dir (skips when no model produces a tool call), and Pi RPC mode loading
the extension directly (skips when the binary is absent).

The repository includes an optional OpenCode pull-request review workflow at
`.github/workflows/opencode-review.yml`. Add an `OPENCODE_API_KEY` Actions secret before
enabling it.

Monitor state is intentionally ignored by Git. Never commit Jira keys, repository names,
Slack URLs, session IDs, webhook payloads, or credentials in tests and examples.

## License

MIT. See [LICENSE](./LICENSE).
