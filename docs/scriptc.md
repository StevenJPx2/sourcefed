# scriptc status (2026-08-05)

Vercel Labs `scriptc@0.0.22` assessment of native-executable compilation for the workspace.
All numbers are from empirical `scriptc coverage` / `scriptc build` runs; rerun before
relying on them.

## Coverage table

| Package | Analyzable | Static coverage | Hard blockers |
|---|---|---|---|
| `@sourcefed/core` | yes | 50/60 statements (83%) | valibot generic methods (SC1090 ×6); valibot values need the dynamic engine (SC2013 ×6); `crypto.randomUUID` |
| `@sourcefed/daemon` | yes | 91/129 (70%) static, 6 (4%) dynamic islands under `--dynamic` | provider `Monitor` class values in `SOURCE_MAP` (SC2009 — the poll `run` function signature carries the full `MonitorRecord` shape); `Object.keys` (SC2020); `Request`/`Response`/`AbortController`/`ReadableStream.*` have no lowering (SC2020); `MonitorService` class values (SC2001) |
| `@sourcefed/provider-{github,jira,slack}` | no (standalone) | — | `Monitor` class declarations rejected (valibot schemas inside); only reached through the daemon graph |
| `@sourcefed/mcp` | no | — | downstream of the daemon graph; `@modelcontextprotocol/server` needs the dynamic engine |
| `@sourcefed/cli` | no | — | inherits the daemon graph plus fs-based skills serving |
| `@sourcefed/opencode`, `@sourcefed/pi` | n/a | — | host-loaded plugins; not native targets |

## Layout

Providers live at the repo root under `providers/{jira,github,slack}` as independent
packages. There is no aggregate `@sourcefed/providers` package: the daemon composes the
built-in registry (`SOURCE_MAP`, `SOURCE_TYPES`, `sourceForInput`, `sourceDefinition`,
`isSource`, `sourceForWebhookPath`) in `packages/daemon/src/registry.ts` by importing the
three provider packages directly. This removed the SC1014 package-re-export blocker from
the daemon's compile graph.

## Blocker categories

1. **Type gate (SC0001)** — cleared. All `response.json()` sites are cast to explicit
   shapes (daemon `http.ts`, `github/api/client.ts`, `slack-api.ts`). The DOM-lib/undici
   divergence (`json(): Promise<unknown>` vs `Promise<any>`) is the recurring pattern;
   any new `await response.json()` must carry an explicit cast or the checker stops.
2. **Class and function-shape values (SC2001/SC2009)** — the poll `run` function carries the
   full `MonitorRecord` parameter shape and cannot compile; `MonitorService` class values
   are rejected. This is the current first build blocker and is inherent to the monitor
   contract, not to any import structure.
3. **Web/stream APIs (SC2020)** — `Request`, `Response`, `AbortController`,
   `ReadableStream.pipe/unpipe/destroy/fromWeb`, `stream.on`, `ChildProcessByStdio.kill`
   have no lowering yet. Blocks the HTTP surface (daemon RPC, SSE, webhooks, the
   `serveHttp` bridge) and the child-process spawn.
4. **Class values (SC2001/SC2009)** — `MonitorService` can't compile; cascades into all
   `daemon.createMonitor`-style method calls and `MonitorRuntime` construction.
5. **Dynamic-engine deps (SC2013)** — valibot and `MonitorEventQueue` run in the embedded
   engine; included by `--dynamic`, which is the only viable mode.

## Verdict

Not buildable yet. Each structural change peels one gate: the Bun-typing wall, then the
SC0001 type gate, then SC1014 package re-exports — all cleared. What remains is scriptc's
checker surface: function values with complex record parameters (the monitor `run`
contract), class values (`MonitorService`), web `Request`/`Response` lowering, valibot
generics, and stdlib odds (`Object.keys`). These are scriptc feature gaps, not sourcefed
defects; the sourcefed side is clean and the coverage commands in this doc can be re-run
unchanged when scriptc grows those.

## Commands

```sh
npx --yes scriptc@0.0.22 coverage packages/core/src/index.ts
npx --yes scriptc@0.0.22 coverage --dynamic packages/daemon/src/index.ts
npx --yes scriptc@0.0.22 build packages/daemon/src/index.ts --dynamic -o /tmp/sf-scriptc-daemon
```

## History

- Bun-era: daemon/CLI blocked by a Bun-typing wall (`Bun.serve`/`Bun.spawn`/shebang).
- Node migration: single SC0001 at daemon `http.ts:20`; cast fixed it.
- Direct-API + api/ splits: 3 new SC0001 at the new `response.json()` sites; casts fixed them.
- Providers restructure: aggregate `@sourcefed/providers` removed; `providers/{jira,github,slack}`
  at repo root; daemon composes the registry directly. SC1014 gone; analysis 74/106 static;
  build stops at provider class values (SC2009).
- CLI moved to `packages/cli/`; daemon fixes (delivery, validation, locks, stop) added
  statements. Current: 91/129 static (70%); build stops at the poll-`run` function-shape
  gap (SC2009), `Object.keys` (SC2020), and class values (SC2001).
