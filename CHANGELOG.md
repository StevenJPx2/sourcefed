# Changelog

## v0.5.0

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.4.2...v0.5.0)

### 🚀 Enhancements

- **core:** Add an optional structured subject to events ([#6](https://github.com/StevenJPx2/sourcefed/pull/6))
- **adapters:** ⚠️  Take one tagged source in monitor_create ([#8](https://github.com/StevenJPx2/sourcefed/pull/8))
- **github:** Add the github-issues collection source ([#10](https://github.com/StevenJPx2/sourcefed/pull/10))
- **jira:** Add the jira-query collection source ([#11](https://github.com/StevenJPx2/sourcefed/pull/11))
- **schedule:** Add the cron schedule source ([#12](https://github.com/StevenJPx2/sourcefed/pull/12))
- **daemon:** Add follow --json and a bounded queue with overflow for program targets ([#13](https://github.com/StevenJPx2/sourcefed/pull/13))

### 🩹 Fixes

- **github:** Quote the failed job's log in CI failure events ([#2](https://github.com/StevenJPx2/sourcefed/pull/2))
- **core:** Keep the poll interval after a failed poll ([#7](https://github.com/StevenJPx2/sourcefed/pull/7))
- **opencode:** Retry a failed daemon connection on the next refresh ([#14](https://github.com/StevenJPx2/sourcefed/pull/14))
- **schedule:** Keep croner's types out of the public declarations ([#15](https://github.com/StevenJPx2/sourcefed/pull/15))

### 🤖 CI

- Pause the OpenCode review workflow until it has a key and model ([#4](https://github.com/StevenJPx2/sourcefed/pull/4))

#### ⚠️ Breaking Changes

- **adapters:** ⚠️  Take one tagged source in monitor_create ([#8](https://github.com/StevenJPx2/sourcefed/pull/8))

### ❤️ Contributors

- Steven John ([@StevenJPx2](https://github.com/StevenJPx2))

## v0.4.2

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.4.1...v0.4.2)

### 🩹 Fixes

- **package:** Name the repository, which npm provenance requires ([181040c](https://github.com/StevenJPx2/sourcefed/commit/181040c))

### 🏡 Chore

- Sync @fdcn/sourcefed to 0.4.1 ([620262b](https://github.com/StevenJPx2/sourcefed/commit/620262b))

### 🤖 CI

- Publish release tags to npm with trusted publishing ([0522c67](https://github.com/StevenJPx2/sourcefed/commit/0522c67))

### ❤️ Contributors

- Steven John <stevenjpx2@gmail.com>

## v0.4.1

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.4.0...v0.4.1)

### 🩹 Fixes

- **opencode:** Add the guidance to compaction and generate requests too ([80bd4ff](https://github.com/StevenJPx2/sourcefed/commit/80bd4ff))

### ❤️ Contributors

- Steven John <stevenjpx2@gmail.com>

## v0.4.0

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.3.8...v0.4.0)

### 🩹 Fixes

- **daemon:** Isolate SSE sockets from the fetch queue ([c6fb892](https://github.com/StevenJPx2/sourcefed/commit/c6fb892))
- **deps:** Upgrade MCP and OpenCode dependency chains ([ff78b28](https://github.com/StevenJPx2/sourcefed/commit/ff78b28))
- **packaging:** Use optional host-provided Pi peers ([e751b71](https://github.com/StevenJPx2/sourcefed/commit/e751b71))
- **types:** Ship declarations for the TUI and Pi entry points ([cf705db](https://github.com/StevenJPx2/sourcefed/commit/cf705db))

### 🏡 Chore

- **release:** Verify exact artifacts with isolated, fail-closed release gates ([1cde23b](https://github.com/StevenJPx2/sourcefed/commit/1cde23b))

### ✅ Tests

- **integration:** Isolate scenarios from the caller's environment ([e2aa8d2](https://github.com/StevenJPx2/sourcefed/commit/e2aa8d2))


## v0.3.8

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.3.7...v0.3.8)

### 🚀 Enhancements

- **yab:** Add Yab feed provider ([7546640](https://github.com/StevenJPx2/sourcefed/commit/7546640))
- **ui:** Stop, start, and delete monitors from the /sourcefed dialog ([bf28080](https://github.com/StevenJPx2/sourcefed/commit/bf28080))

### 🏡 Chore

- Sync @fdcn/sourcefed to 0.3.7 ([7144728](https://github.com/StevenJPx2/sourcefed/commit/7144728))
- Describe the project for stevenjohn.co's resume ([a0558eb](https://github.com/StevenJPx2/sourcefed/commit/a0558eb))

### ❤️ Contributors

- Steven John ([@StevenJPx2](https://github.com/StevenJPx2))

## v0.3.7

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.3.6...v0.3.7)

### 🩹 Fixes

- **opencode:** Bound shared session subscriptions ([625ceca](https://github.com/StevenJPx2/sourcefed/commit/625ceca))

### 🏡 Chore

- Sync @fdcn/sourcefed to 0.3.6 ([d71a220](https://github.com/StevenJPx2/sourcefed/commit/d71a220))

### ❤️ Contributors

- Steven John <stevenjpx2@gmail.com>

## v0.3.6

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.3.5...v0.3.6)

### 🩹 Fixes

- **opencode:** Hide the sidebar section when no monitor is active ([4db680e](https://github.com/StevenJPx2/sourcefed/commit/4db680e))
- **setup:** Stop adding sourcefed to OpenCode's cli.json ([81870c6](https://github.com/StevenJPx2/sourcefed/commit/81870c6))

### 📖 Documentation

- Show standalone sourcefed delivering CI failures and review comments ([a390670](https://github.com/StevenJPx2/sourcefed/commit/a390670))
- Lead the README with the demo ([07d855b](https://github.com/StevenJPx2/sourcefed/commit/07d855b))

### 🏡 Chore

- Sync @fdcn/sourcefed to 0.3.5 ([1d3632e](https://github.com/StevenJPx2/sourcefed/commit/1d3632e))

### ❤️ Contributors

- Steven John <stevenjpx2@gmail.com>

## v0.3.5

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.3.4...v0.3.5)

### 🩹 Fixes

- **opencode:** Deliver monitors that other clients create after startup ([28f4464](https://github.com/StevenJPx2/sourcefed/commit/28f4464))
- **opencode:** Inject the guidance unless a copy is already there ([6085571](https://github.com/StevenJPx2/sourcefed/commit/6085571))

### 📖 Documentation

- Agent guidance covers only using monitors ([fc669ce](https://github.com/StevenJPx2/sourcefed/commit/fc669ce))

### 🏡 Chore

- Sync @fdcn/sourcefed to 0.3.4 ([0aa2d4b](https://github.com/StevenJPx2/sourcefed/commit/0aa2d4b))

### ❤️ Contributors

- Steven John <stevenjpx2@gmail.com>

## v0.3.4

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.3.3...v0.3.4)

### 🚀 Enhancements

- **opencode:** Send the event's monitorID to chauffeur.gate ([30540e0](https://github.com/StevenJPx2/sourcefed/commit/30540e0))

### 🩹 Fixes

- **opencode:** Resubscribe monitored sessions after a restart ([6e3edc1](https://github.com/StevenJPx2/sourcefed/commit/6e3edc1))
- Cache Slack's user list, name Slack errors, ack IDs with commas ([0bbae2e](https://github.com/StevenJPx2/sourcefed/commit/0bbae2e))

### 🏡 Chore

- Sync @fdcn/sourcefed to 0.3.3 ([1baebd4](https://github.com/StevenJPx2/sourcefed/commit/1baebd4))

### ❤️ Contributors

- Steven John <stevenjpx2@gmail.com>

## v0.3.3

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.3.2...v0.3.3)

### 🚀 Enhancements

- **daemon:** Let a local consumer gate event delivery ([b909862](https://github.com/StevenJPx2/sourcefed/commit/b909862))
- **opencode:** Gate delivery through Chauffeur's plugin RPC ([c27fda6](https://github.com/StevenJPx2/sourcefed/commit/c27fda6))
- **adapters:** Deliver monitor events as labelled synthetic messages, like Chauffeur ([c847cf0](https://github.com/StevenJPx2/sourcefed/commit/c847cf0))

### 🏡 Chore

- Sync @fdcn/sourcefed to 0.3.2 ([358330e](https://github.com/StevenJPx2/sourcefed/commit/358330e))

### ❤️ Contributors

- Steven John <stevenjpx2@gmail.com>

## v0.3.2

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.3.1...v0.3.2)

### 🩹 Fixes

- **opencode:** Align TUI theme with OpenCode 2.0.12 ([c3da1e5](https://github.com/StevenJPx2/sourcefed/commit/c3da1e5))

### 🏡 Chore

- Sync @fdcn/sourcefed to 0.3.1 ([26769ab](https://github.com/StevenJPx2/sourcefed/commit/26769ab))

### ❤️ Contributors

- Steven John <stevenjpx2@gmail.com>

## v0.3.1

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.3.0...v0.3.1)

### 🩹 Fixes

- **daemon:** Stop replaying a stopped monitor's queued events ([60b5f1f](https://github.com/StevenJPx2/sourcefed/commit/60b5f1f))
- **opencode:** Repair v2 plugin setup and TUI registration ([895dfd9](https://github.com/StevenJPx2/sourcefed/commit/895dfd9))

### 🏡 Chore

- Sync @fdcn/sourcefed to 0.3.0 ([553d836](https://github.com/StevenJPx2/sourcefed/commit/553d836))

### ❤️ Contributors

- Steven John <stevenjpx2@gmail.com>

## v0.3.0

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.2.9...v0.3.0)

### 🚀 Enhancements

- **opencode:** ⚠️  Migrate adapter to OpenCode plugin API v2 ([eb9a9ab](https://github.com/StevenJPx2/sourcefed/commit/eb9a9ab))
- Add package-lock ([73cdc8e](https://github.com/StevenJPx2/sourcefed/commit/73cdc8e))

### 🩹 Fixes

- **daemon:** Stop replaying a stopped monitor's queued events ([d0cae57](https://github.com/StevenJPx2/sourcefed/commit/d0cae57))

### 🏡 Chore

- Sync @fdcn/sourcefed to 0.2.9 ([ee7a23f](https://github.com/StevenJPx2/sourcefed/commit/ee7a23f))
- Bump to 0.3.0-next.0 ([d89cb28](https://github.com/StevenJPx2/sourcefed/commit/d89cb28))

#### ⚠️ Breaking Changes

- **opencode:** ⚠️  Migrate adapter to OpenCode plugin API v2 ([eb9a9ab](https://github.com/StevenJPx2/sourcefed/commit/eb9a9ab))

### ❤️ Contributors

- Steven John <stevenjpx2@gmail.com>

## v0.2.9

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.2.8...v0.2.9)

### 🚀 Enhancements

- **slack:** Monitor whole DM conversations ([bd906af](https://github.com/StevenJPx2/sourcefed/commit/bd906af))

### 🩹 Fixes

- **opencode:** Show monitor names in sidebar ([fadcf69](https://github.com/StevenJPx2/sourcefed/commit/fadcf69))

### 🏡 Chore

- Sync @fdcn/sourcefed to 0.2.8 ([389edca](https://github.com/StevenJPx2/sourcefed/commit/389edca))

### ❤️ Contributors

- Steven John <stevenjpx2@gmail.com>

## v0.2.8

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.2.7...v0.2.8)

### 🩹 Fixes

- **pi:** Prevent stale-ctx crash in status refresh timer ([9f80816](https://github.com/StevenJPx2/sourcefed/commit/9f80816))

### 🏡 Chore

- Sync @fdcn/sourcefed to 0.2.7 ([c73389c](https://github.com/StevenJPx2/sourcefed/commit/c73389c))

### ❤️ Contributors

- Steven John <stevenjpx2@gmail.com>

## v0.2.7

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.2.6...v0.2.7)

### 🩹 Fixes

- **jira:** Track changelog by history id so state changes report correctly ([cf485fd](https://github.com/StevenJPx2/sourcefed/commit/cf485fd))

### 🏡 Chore

- Sync @fdcn/sourcefed to 0.2.6 ([e4cc297](https://github.com/StevenJPx2/sourcefed/commit/e4cc297))

### ❤️ Contributors

- Steven John <stevenjpx2@gmail.com>

## v0.2.6

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.2.5...v0.2.6)

### 🩹 Fixes

- **release:** Clean dist before rebuild and ignore .release output ([35046f0](https://github.com/StevenJPx2/sourcefed/commit/35046f0))
- **opencode:** Keep the session's current model when delivering events ([c216106](https://github.com/StevenJPx2/sourcefed/commit/c216106))

### 🏡 Chore

- Sync @fdcn/sourcefed to 0.2.5 ([695bba7](https://github.com/StevenJPx2/sourcefed/commit/695bba7))

### ❤️ Contributors

- Steven John <stevenjpx2@gmail.com>

## v0.2.5

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.2.4...v0.2.5)

### 🩹 Fixes

- **release:** Pack from the package cwd, not a root path arg ([2ee8cd2](https://github.com/StevenJPx2/sourcefed/commit/2ee8cd2))
- **release:** Registry-based publish guard, resumable sync commit ([2b85b28](https://github.com/StevenJPx2/sourcefed/commit/2b85b28))
- **daemon:** Deliver each monitor event once across concurrent subscribers ([7d62292](https://github.com/StevenJPx2/sourcefed/commit/7d62292))

### 🏡 Chore

- Sync @fdcn/sourcefed to 0.2.4 ([fe3db37](https://github.com/StevenJPx2/sourcefed/commit/fe3db37))

### 🤖 CI

- Changelogen creates the GitHub release; drop redundant release.yml ([78c9805](https://github.com/StevenJPx2/sourcefed/commit/78c9805))

### ❤️ Contributors

- Steven John <stevenjpx2@gmail.com>

## v0.2.4

[compare changes](https://github.com/StevenJPx2/sourcefed/compare/v0.2.3...v0.2.4)

### 🚀 Enhancements

- **github:** Render HTML comment bodies as markdown ([3ade5bb](https://github.com/StevenJPx2/sourcefed/commit/3ade5bb))

### 📖 Documentation

- Release plan matches the changelogen-driven pipeline ([0980016](https://github.com/StevenJPx2/sourcefed/commit/0980016))

### 🏡 Chore

- **release:** V0.2.1 ([89f9f77](https://github.com/StevenJPx2/sourcefed/commit/89f9f77))
- Align root version to published 0.2.3 as the changelogen source of truth ([83422e3](https://github.com/StevenJPx2/sourcefed/commit/83422e3))

### 🤖 CI

- One-command release pipeline (scripts/release/publish.mjs) ([95a7164](https://github.com/StevenJPx2/sourcefed/commit/95a7164))
- Changelogen-driven releases; pins as a separate step ([10082e0](https://github.com/StevenJPx2/sourcefed/commit/10082e0))

### ❤️ Contributors

- Steven John <stevenjpx2@gmail.com>

