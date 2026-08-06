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

OpenCode loads this package as both a server and a TUI plugin:

```json
// opencode.json
{ "plugin": ["@fdcn/sourcefed@0.2.2"] }
```

```json
// tui.json
{ "plugin": ["@fdcn/sourcefed@0.2.2"] }
```

The package exposes `./server`, `./tui`, `./opencode`, `./opencode/tui`, and `./pi` entrypoints for hosts that load them directly.

## Skills

```sh
sourcefed skills list
sourcefed skills get core
```
