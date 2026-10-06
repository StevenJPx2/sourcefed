# Contributing

1. Install Node.js 22+ and a compatible OpenCode release.
2. Run `npm install`.
3. Run `npm run check` before opening a pull request.
4. Keep source-specific behavior inside its source directory.
5. Do not commit `.env`, `.state`, credentials, or real workspace identifiers.

Changes that affect webhook payloads or monitor persistence should include focused
regression tests.

## Monitors and transports

The abstract `Monitor` consolidates transport fallback and recovery and composes whichever
generic `PollMonitor` and `WebhookMonitor` transports a source exposes as class attributes.
Each provider is its own package (`@sourcefed/provider-{jira,github,slack}`) with monitor and
event modules; the built-in registry (`SOURCE_MAP`) is composed by the daemon, which imports
the provider packages directly. Jira exposes only polling; GitHub and Slack expose both. Do
not add source-specific transport branches to tools, scheduling, or the daemon.
