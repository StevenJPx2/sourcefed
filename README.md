# Sourcefed

Sourcefed is an OpenCode plugin that feeds live source activity into the agent session
where a monitor was created. It watches Jira issues, GitHub pull requests, and Slack
threads. It is detect-only: Slack and webhook integrations never reply on your behalf.

## Features

- Session-scoped `monitor_create`, `monitor_list`, `monitor_status`, and `monitor_stop` tools.
- GitHub and Slack webhook delivery with automatic polling fallback and recovery.
- Jira polling with optional configurable terminal-status cleanup.
- Durable cursors and pending delivery state under the local `.state/` directory.
- An OpenCode TUI sidebar and monitor details dialog.

## Install

Sourcefed is loaded as a local OpenCode plugin. Clone it into the plugin directory used by
your OpenCode installation, or add it as a submodule in your dotfiles repository:

```sh
git clone https://github.com/StevenJPx2/sourcefed.git ~/.config/opencode/plugins/sourcefed
cd ~/.config/opencode/plugins/sourcefed
bun install
```

Register `index.ts` as a server plugin and `tui.ts` as a TUI plugin. Load `GUIDANCE.md`
through your OpenCode instructions configuration if you want the agent to create monitors
automatically when it finds a ticket, pull request, or Slack thread. A thin local loader can
re-export the server entry when your OpenCode installation expects a plugin file:

```ts
export { default } from "/path/to/sourcefed/index.ts"
```

## Configuration

Copy `.env.example` to a secure environment configuration and set only the integrations you
use. Jira requires `SOURCEFED_JIRA_BASE_URL`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_API_KEY`.
GitHub and Slack webhook secrets are optional; when absent, those sources use polling.

The webhook listener exposes `/webhooks/github` and `/webhooks/slack`. Put it behind an
HTTPS reverse proxy before registering provider webhooks. Set `SOURCEFED_WEBHOOK_HOST` and
`SOURCEFED_WEBHOOK_PORT` for the local listener.

Slack polling uses the local `slackcli` command and its own authenticated account store.
Slack monitors read and notify only; they do not send messages.

## Development

```sh
bun install
bun run check
```

## GitHub Reviews

The repository includes an optional OpenCode pull-request review workflow at
`.github/workflows/opencode-review.yml`. Add an `OPENCODE_API_KEY` Actions secret before
enabling it. The workflow uses the OpenCode Zen `deepseek-v4-flash` model through the official
`anomalyco/opencode/github` action and read-only pull-request permissions.

Monitor state is intentionally ignored by Git. Never commit real Jira keys, repository
names, Slack URLs, session IDs, webhook payloads, or credentials in tests and examples.

## License

MIT. See [LICENSE](./LICENSE).
