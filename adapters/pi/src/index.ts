import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Type } from "typebox"
import type { QueuedMonitorEvent } from "@sourcefed/core"
import { connectSourcefedClient, listenForTarget, localDaemonEnvironment, localMcpCommand, parseToolResult } from "@sourcefed/mcp"

type PiTarget = { kind: "pi-session"; id: string }

export default async function sourcefedExtension(pi: ExtensionAPI): Promise<void> {
  const local = localMcpCommand(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..", "apps/cli/src/index.ts"))
  const client = await connectSourcefedClient({
    name: "sourcefed-pi",
    url: process.env.SOURCEFED_MCP_URL,
    command: local.command,
    args: process.env.SOURCEFED_MCP_ARGS?.split(" ") ?? local.args,
    env: localDaemonEnvironment("pi"),
  })
  const listeners = new Map<string, { close(): Promise<void> }>()

  pi.on("session_start", async (_event, ctx) => {
    await ensureTarget(ctx)
  })

  pi.on("session_shutdown", async () => {
    for (const listener of listeners.values()) await listener.close()
    listeners.clear()
    await client.close()
  })

  pi.registerTool({
    name: "sourcefed_monitor_create",
    label: "Sourcefed monitor create",
    description: "Create or reuse a Sourcefed monitor for the current Pi session.",
    parameters: Type.Object({
      name: Type.String(),
      sourceType: Type.Union([Type.Literal("jira"), Type.Literal("github"), Type.Literal("slack")]),
      issueKey: Type.Optional(Type.String()),
      repo: Type.Optional(Type.String()),
      prNumber: Type.Optional(Type.Number()),
      channelId: Type.Optional(Type.String()),
      threadTs: Type.Optional(Type.String()),
      threadUrl: Type.Optional(Type.String()),
      pollIntervalSec: Type.Optional(Type.Number()),
    }),
    execute: async (_toolCallID, input, _signal, _onUpdate, ctx) => toolResult(await call(ctx, "monitor_create", input)),
  })

  pi.registerTool({
    name: "sourcefed_monitor_list",
    label: "Sourcefed monitor list",
    description: "List Sourcefed monitors for the current Pi session.",
    parameters: Type.Object({}),
    execute: async (_toolCallID, _input, _signal, _onUpdate, ctx) => toolResult(await call(ctx, "monitor_list", {})),
  })

  pi.registerTool({
    name: "sourcefed_monitor_status",
    label: "Sourcefed monitor status",
    description: "Read one Sourcefed monitor for the current Pi session.",
    parameters: Type.Object({ id: Type.String() }),
    execute: async (_toolCallID, input, _signal, _onUpdate, ctx) => toolResult(await call(ctx, "monitor_status", input)),
  })

  pi.registerTool({
    name: "sourcefed_monitor_stop",
    label: "Sourcefed monitor stop",
    description: "Stop one Sourcefed monitor for the current Pi session.",
    parameters: Type.Object({ id: Type.String() }),
    execute: async (_toolCallID, input, _signal, _onUpdate, ctx) => toolResult(await call(ctx, "monitor_stop", input)),
  })

  pi.registerCommand("sourcefed", {
    description: "List Sourcefed monitors for the current Pi session",
    handler: async (_args, ctx) => {
      const result = await call(ctx, "monitor_list", {})
      ctx.ui.notify(JSON.stringify(parseToolResult(result)), "info")
    },
  })

  async function call(ctx: ExtensionContext, name: string, args: Record<string, unknown>): Promise<unknown> {
    const target = await ensureTarget(ctx)
    return client.callTool({ name, arguments: { ...args, target } })
  }

  async function ensureTarget(ctx: ExtensionContext): Promise<PiTarget> {
    const target = { kind: "pi-session" as const, id: ctx.sessionManager.getSessionId() }
    if (!listeners.has(target.id)) {
      const listener = await listenForTarget(client, target, async (events) => {
        await routeEvents(pi, events)
      })
      listeners.set(target.id, listener)
    }
    return target
  }
}

async function routeEvents(pi: ExtensionAPI, events: QueuedMonitorEvent[]): Promise<void> {
  for (const queued of events) {
    await pi.sendMessage({
      customType: "sourcefed-monitor",
      content: `[sourcefed monitor] ${queued.event.summary}${queued.event.body ? `\n\n${queued.event.body}` : ""}`,
      display: true,
      details: { actionable: queued.event.actionable, eventID: queued.id },
    }, { triggerTurn: queued.event.actionable, deliverAs: "steer" })
  }
}

function toolResult(result: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(parseToolResult(result)) }],
    details: {},
  }
}
