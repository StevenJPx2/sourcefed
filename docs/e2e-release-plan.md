# End-to-End Release Plan

## Goal

Every npm release of `@fdcn/sourcefed` is tested as the exact tarball that will be published. The release gate covers the CLI, daemon, MCP transports, OpenCode server and TUI plugins, Pi extension, and Homebrew formula without relying on private workspace packages or existing user state.

The release command is:

```sh
npm run release:verify -- 0.2.2
npm run release:publish -- 0.2.2
```

`release:publish` accepts only the tarball produced and recorded by `release:verify`. It performs no rebuild.

## Artifact Flow

```text
clean checkout
  -> npm ci
  -> npm run check
  -> npm pack packages/sourcefed
  -> isolated E2E suite against the tarball
  -> local Homebrew tap test against the tarball
  -> publish the same tarball
  -> registry canary
  -> update OpenCode, Pi, and Homebrew pins
```

The verifier writes `.release/manifest.json` containing the version, tarball path, SHA-256, git commit, Node version, OpenCode version, and Pi version. Publishing fails if the tarball hash, git commit, version, or working-tree state differs.

## Isolation Rules

- Install only the candidate `@fdcn/sourcefed` tarball and its registry dependencies in the E2E consumer. Do not install any private `@sourcefed/*` workspace package.
- Use a fresh temporary `HOME`, `XDG_CONFIG_HOME`, `XDG_STATE_HOME`, `PI_CODING_AGENT_DIR`, and npm prefix for each host test.
- Allocate free daemon, webhook, MCP, and mock-provider ports dynamically.
- Give every daemon a unique `SOURCEFED_STATE_DIR`.
- Record and terminate every child process in `finally`/trap cleanup.
- Do not use live Jira, GitHub, Slack, or model-provider credentials. Use deterministic local HTTP stubs.
- Release mode treats missing host binaries, skipped scenarios, timeouts, leaked processes, and stale state as failures.

## Test Matrix

| Surface | Required proof |
| --- | --- |
| Tarball | Only intended files ship; every export/bin/Pi target exists; no `.ts`/`.tsx`; no runtime import of private packages |
| Types | A clean TypeScript consumer imports every public subpath and emits successfully |
| CLI | The npm-created `node_modules/.bin/sourcefed` symlink runs skills, daemon, monitor CRUD, and logs |
| Daemon | A fresh daemon starts from the packaged `dist/cli.js`, writes only to its temporary state directory, and survives a client reconnect |
| MCP stdio | Initialize, tools/list, monitor tool call, resource read, acknowledgement, and clean shutdown |
| MCP HTTP | Initialize and monitor calls over HTTP on an allocated port; authentication and shutdown paths |
| Providers | Jira, GitHub, and Slack poll/webhook flows use local HTTP fixtures and persist cursors/events |
| OpenCode server | The real host loads `exports["./server"]`, registers tools, spawns the packaged CLI, and creates a monitor |
| OpenCode TUI | The real TUI loads `exports["./tui"]`; sidebar, `/sourcefed`, and `/sourcefed-logs` render in tmux |
| Pi | The real host loads `pi.extensions`, spawns the packaged CLI, registers tools/commands, and reports daemon status |
| Homebrew | A local tap installs the candidate tarball with Node, runs the bin, passes `brew test`, and uninstalls cleanly |

## Package Checks

Run `npm pack --json` once, then inspect the tarball directly.

Required assertions:

- Package name and version match the requested release.
- `bin.sourcefed` resolves and is executable through npm's symlink.
- Export targets exist for `.`, `./core`, `./core/storage`, `./daemon`, `./mcp`, `./server`, `./tui`, `./opencode`, `./opencode/tui`, and `./pi`.
- `pi.extensions` resolves to `dist/pi.js`.
- Public declarations contain no `@sourcefed/*` dependency.
- Esbuild metadata contains no external `@sourcefed/*` dependency.
- The installed consumer has no `node_modules/@sourcefed` directory.
- README, LICENSE, guidance, skill data, and declarations are present.

## CLI, Daemon, And MCP

The CLI scenario invokes the installed bin, not `node dist/cli.js`:

```sh
./node_modules/.bin/sourcefed skills list
./node_modules/.bin/sourcefed daemon --port "$PORT"
./node_modules/.bin/sourcefed monitor create --source-type jira --issue-key PROJ-1 --name PROJ-1 --target-kind e2e --target-id cli
```

Assertions cover human-readable list/log output, JSON mutation output, persisted monitor state, stop/start/remove, and a restart from the same state directory.

The MCP scenario drives protocol frames directly. It verifies stdio and HTTP independently so CLI dispatch, transport startup, daemon ownership, tool schemas, resources, and acknowledgements are exercised.

## OpenCode

Pin the oldest supported and current supported OpenCode versions in the release matrix.

The server test uses an isolated OpenCode config whose only plugin is the candidate package directory. A local OpenAI-compatible stub returns a deterministic `monitor_create` tool call, then a final response. The test fails unless:

- OpenCode resolves `exports["./server"]`.
- `monitor_create` appears in the request sent to the model stub.
- The tool executes exactly once.
- A monitor is persisted in the temporary daemon state.
- The daemon child command points at the candidate package's `dist/cli.js`.

The TUI test runs in a dedicated tmux session at a fixed terminal size. It starts a real session, invokes `/sourcefed` and `/sourcefed-logs`, and captures the pane. Assertions require the Sourcefed sidebar, monitor dialog title, empty/list state, notifications dialog, side padding, and absence of clipping or duplicate identifiers. UI changes also require a human live-render check before release approval.

## Pi

Pin the supported Pi version in the release matrix. Start Pi in RPC mode with the candidate package's `dist/pi.js`, isolated settings, and a unique daemon port/state directory.

Assertions require:

- Extension initialization and `sourcefed` status updates.
- Tool and `/sourcefed` command registration.
- Daemon startup through sibling `dist/cli.js` without `@sourcefed/cli` installed.
- Monitor creation and persisted state.
- Clean extension and daemon shutdown.

After npm publication, a canary installs `npm:@fdcn/sourcefed@<version>` through `pi install` and repeats initialization without `--extension`.

## Homebrew

Before npm publication, generate a temporary local tap formula whose URL is the candidate tarball's `file://` URL and whose SHA-256 comes from `.release/manifest.json`.

```sh
brew tap-new sourcefed/e2e
brew install sourcefed/e2e/sourcefed
brew test sourcefed/e2e/sourcefed
sourcefed skills list
brew uninstall sourcefed
```

The formula test uses `sourcefed skills list`; it does not depend on an existing daemon. After npm publication, update the permanent tap to the registry tarball URL, run `brew fetch --force`, install it in a clean prefix, and verify the reported version and CLI behavior.

## Registry Canary

After publishing the verified tarball:

1. Wait until the registry version and `latest` tag are readable.
2. Install `@fdcn/sourcefed@<version>` into a fresh consumer.
3. Repeat CLI import/bin checks.
4. Let OpenCode auto-install the exact registry version and verify server and TUI entrypoints.
5. Let Pi install the exact registry version and verify extension initialization.
6. Update dotfiles and Homebrew only after all canaries pass.

A canary failure blocks configuration/tap updates. Deprecate the failed npm version with a clear message and prepare a new patch release from a clean commit.

## Automation Layout

```text
scripts/release/verify.mjs
scripts/release/publish.mjs
scripts/e2e/package.mjs
scripts/e2e/cli-daemon.mjs
scripts/e2e/mcp.mjs
scripts/e2e/opencode.mjs
scripts/e2e/pi.mjs
scripts/e2e/homebrew.mjs
scripts/e2e/registry-canary.mjs
```

`scripts/integration.mjs` remains the developer integration suite. The release verifier owns aggregate-only isolation and never accepts a skipped scenario.

## CI And Approval

- Linux runs package, types, CLI, daemon, MCP, provider, OpenCode server, and Pi tests.
- macOS runs the same suite plus OpenCode TUI tmux and Homebrew tests.
- CI uploads the tarball and `.release/manifest.json` as immutable artifacts.
- Publishing requires green required jobs and human npm 2FA approval.
- The release summary records every scenario, host version, duration, and artifact hash.

## Implementation Order

1. Split aggregate-only release E2E from the private-workspace integration consumer.
2. Add tarball/export/declaration validation and exact-artifact manifesting.
3. Add deterministic CLI, daemon, and MCP scenarios.
4. Add deterministic OpenCode server stub and tmux TUI scenario.
5. Add Pi settings/package scenario.
6. Add local and registry Homebrew scenarios.
7. Add release verification/publish scripts and CI jobs.
8. Require `release:verify` output for every publish.

## Completion Criteria

The release pipeline is complete when a clean checkout can produce one tarball, pass every scenario without skips, publish that exact tarball after human approval, pass registry canaries, and update OpenCode, Pi, and Homebrew pins only after verification.
