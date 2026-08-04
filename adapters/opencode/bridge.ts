import type { Client } from "@modelcontextprotocol/client"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { connectSourcefedClient, listenForTarget, localDaemonEnvironment, localMcpCommand, parseToolResult } from "@sourcefed/mcp"
import type { QueuedMonitorEvent } from "@sourcefed/core"
import type { createOpencodeClient } from "@opencode-ai/sdk"

type OpenCodeClient = ReturnType<typeof createOpencodeClient>
type Target = { kind: "opencode-session"; id: string }

let activeBridge: OpenCodeBridge | undefined

export class OpenCodeBridge {
  private mcp?: Client
  private readonly listeners = new Map<string, { close(): Promise<void> }>()

  constructor(private readonly opencode: OpenCodeClient) {}

  async start(): Promise<void> {
    if (this.mcp) return
    const local = localMcpCommand(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..", "apps/cli/src/index.ts"))
    this.mcp = await connectSourcefedClient({
      name: "sourcefed-opencode",
      url: process.env.SOURCEFED_MCP_URL,
      command: local.command,
      args: local.args,
      env: localDaemonEnvironment("opencode", path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..", ".state", "monitors.json")),
    })
  }

  async ensureTarget(sessionID: string): Promise<void> {
    await this.start()
    if (this.listeners.has(sessionID)) return
    const target = this.target(sessionID)
    const listener = await listenForTarget(this.mcp!, target, async (events) => {
      await this.routeEvents(events)
    })
    this.listeners.set(sessionID, listener)
  }

  async callTool(name: string, arguments_: Record<string, unknown>, sessionID: string): Promise<unknown> {
    await this.ensureTarget(sessionID)
    const result = await this.mcp!.callTool({ name, arguments: { ...arguments_, target: this.target(sessionID) } })
    return parseToolResult(result)
  }

  async close(): Promise<void> {
    for (const listener of this.listeners.values()) await listener.close()
    this.listeners.clear()
    await this.mcp?.close()
    this.mcp = undefined
  }

  private async routeEvents(events: QueuedMonitorEvent[]): Promise<void> {
    for (const queued of events) {
      const body = {
        ...(queued.event.actionable ? {} : { noReply: true }),
        parts: [{ type: "text" as const, text: eventText(queued.event) }],
      }
      await this.opencode.session.prompt({ path: { id: queued.target.id }, body })
    }
  }

  private target(sessionID: string): Target {
    return { kind: "opencode-session", id: sessionID }
  }
}

export function setOpenCodeBridge(bridge: OpenCodeBridge): void {
  activeBridge = bridge
}

export function getOpenCodeBridge(): OpenCodeBridge {
  if (!activeBridge) throw new Error("Sourcefed OpenCode bridge is not initialized")
  return activeBridge
}

function eventText(event: QueuedMonitorEvent["event"]): string {
  const header = `[sourcefed monitor] ${event.summary}`
  return event.body ? `${header}\n\n${event.body}` : header
}
