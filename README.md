# Sourcefed

Sourcefed is a host-independent monitor engine for Jira issues, GitHub pull requests, and
Slack threads. It is detect-only: it never replies to Jira, GitHub, or Slack. The same core is
available through an MCP daemon, CLI, Pi extension, and OpenCode plugin.

## Architecture

```text
Pi / OpenCode / CLI
        | MCP tools and resource subscriptions
        v
Sourcefed MCP daemon
        | @sourcefed/core
        | @sourcefed/store
        v
Jira / GitHub / Slack providers
```

The daemon owns polling, webhook handling, cursors, monitor identity, retries, and the shared
state store. Hosts only provide a target identity and an event presentation bridge.

New events use the current MCP 2026 resource-subscription flow:

1. A host subscribes with `subscriptions/listen` to its `sourcefed://targets/.../events` resource.
2. The daemon publishes `notifications/resources/updated`.
3. The host reads the resource, presents the events, and calls `monitor_events_ack`.

## Install

```sh
git clone https://github.com/StevenJPx2/sourcefed.git ~/.config/opencode/plugins/sourcefed
cd ~/.config/opencode/plugins/sourcefed
bun install
```

The root package exports the OpenCode server plugin (`index.ts`) and TUI entry (`tui.ts`). The
other workspace packages are `@sourcefed/core`, `@sourcefed/store`, `@sourcefed/mcp`,
`@sourcefed/cli`, `@sourcefed/pi`, and `@sourcefed/opencode`.

## MCP Daemon

Start a shared local HTTP daemon:

```sh
sourcefed mcp --http
```

Or start a stdio daemon for a single host:

```sh
sourcefed mcp --stdio
```

The HTTP endpoint defaults to `http://127.0.0.1:8787/mcp`. Configure clients with
`SOURCEFED_MCP_URL`. The current MCP v2 SDK negotiates the modern 2026 protocol automatically.

## CLI

The CLI is an MCP client for monitor management:

```sh
sourcefed monitor list --target-id my-terminal
sourcefed monitor create --source-type jira --issue-key ADEPT-43742 --name ADEPT-43742
sourcefed monitor status --id MONITOR_ID
sourcefed monitor stop --id MONITOR_ID
```

Set `SOURCEFED_MCP_URL` when the daemon is not at the default URL.

## OpenCode And Pi

The OpenCode plugin uses MCP for every monitor tool. Without `SOURCEFED_MCP_URL`, it starts a
local stdio MCP child process with host-specific state. Set the variable to share one HTTP
daemon and one monitor registry with other hosts.

The Pi extension follows the same rule and registers `sourcefed_monitor_*` tools plus a
`/sourcefed` command.

## Configuration

Copy `.env.example` to a secure environment configuration and set only the integrations you
use. Jira requires `SOURCEFED_JIRA_BASE_URL`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_API_KEY`.
GitHub and Slack webhook secrets are optional; without them those sources use polling.

The JSON store defaults to `$XDG_STATE_HOME/sourcefed` or `~/.local/state/sourcefed`. The MCP
HTTP endpoint also accepts provider webhooks at `/webhooks/github` and `/webhooks/slack`.

GitHub polling uses `gh`. Slack polling uses the local `slackcli` command and its authenticated
account store. Slack monitors read and notify only; they do not send messages.

## Development

```sh
bun install
bun run check
```

The repository includes an optional OpenCode pull-request review workflow at
`.github/workflows/opencode-review.yml`. Add an `OPENCODE_API_KEY` Actions secret before
enabling it.

Monitor state is intentionally ignored by Git. Never commit Jira keys, repository names,
Slack URLs, session IDs, webhook payloads, or credentials in tests and examples.

## License

MIT. See [LICENSE](./LICENSE).
