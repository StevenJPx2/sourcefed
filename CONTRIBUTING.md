# Contributing

1. Install Node.js 22+ and a compatible OpenCode release.
2. Run `npm install`.
3. Run `npm run check` before opening a pull request.
4. Keep source-specific behavior inside its source directory.
5. Do not commit `.env`, `.state`, credentials, or real workspace identifiers.

Changes that affect webhook payloads or monitor persistence should include focused
regression tests.
