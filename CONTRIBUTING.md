# Contributing

1. Install Bun and a compatible OpenCode release.
2. Run `bun install`.
3. Run `bun run check` before opening a pull request.
4. Keep source-specific behavior inside its source directory.
5. Do not commit `.env`, `.state`, credentials, or real workspace identifiers.

Changes that affect webhook payloads or monitor persistence should include focused
regression tests.
