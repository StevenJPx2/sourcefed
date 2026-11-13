# @fdcn/sourcefed

Live Jira, GitHub, and Slack monitoring for agent hosts: CLI, daemon, MCP server, and host plugins.

## CLI

```sh
npm install --global @fdcn/sourcefed

sourcefed daemon
sourcefed mcp --stdio | --http [--port PORT]
sourcefed monitor create|list|status|stop|start|remove|events|ack|logs|sources [options]
sourcefed skills [list|get <name>|path [name]]
```

## Library

```ts
import { connectDaemonClient } from "@fdcn/sourcefed/daemon"
import { MonitorService } from "@fdcn/sourcefed/core"
import { createSourcefedMcp } from "@fdcn/sourcefed/mcp"
```

- `@fdcn/sourcefed` — CLI entry (`sourcefed` binary)
- `@fdcn/sourcefed/core` — transport-agnostic core (monitors, sources, events, cursors, persistence)
- `@fdcn/sourcefed/core/storage` — JSON persistence
- `@fdcn/sourcefed/daemon` — daemon service and HTTP/SSE client
- `@fdcn/sourcefed/mcp` — MCP server adapter

## Host plugins

OpenCode loads this package as both a server and a TUI plugin from one entry:

```json
// ~/.config/opencode/opencode.jsonc
{ "plugins": ["@fdcn/sourcefed@0.5.1"] }
```

The package exposes `./server`, `./tui`, `./opencode`, `./opencode/tui`, and `./pi` entrypoints for hosts that load them directly.

## Host dependencies

Pi provides `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui` and
`typebox` through its extension loader. Sourcefed declares each as an optional
peer with a `"*"` range and leaves their imports external in `dist/pi.js`, matching
[Pi’s package contract](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md#dependencies).
OpenCode, CLI, daemon and MCP entry points do not import these peers. A plain npm
install downloads no Pi host packages; a Pi host supplies its own versions.

Install the extension through the Pi host:

```sh
pi install npm:@fdcn/sourcefed@0.5.1
```

The workspace uses pinned development dependencies to compile and test the Pi
adapter. Those development tools are separate from the published runtime.

From a checkout, verify the packed package:

```sh
npm run check

node scripts/check-optional-pi.mjs
```

The check packs and installs Sourcefed into fresh temporary directories. It
verifies the absence of Pi packages, imports the non-Pi libraries, loads the
installed plugin in a private OpenCode host, and loads the Pi-managed extension
in RPC mode without a model request. The Pi installer uses an isolated
`npmCommand` wrapper that substitutes the local tarball for the package’s npm
spec; the registry contains only published releases. The check needs OpenCode,
OpenSSL and the workspace’s Pi development host. Its audit output includes
remaining OpenCode dependencies and does not certify a clean security gate.

## Skills

```sh
sourcefed skills list
sourcefed skills get core
```
