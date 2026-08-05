import { createMcpHandler, McpServer, ResourceTemplate } from "@modelcontextprotocol/server"
import * as z from "zod/v4"
import type { MonitorTarget } from "@sourcefed/core"
import type { DaemonCreateInput, SourcefedDaemon } from "@sourcefed/daemon"
import { decodeTarget, eventResourceUri } from "./uris.ts"

export type SourcefedMcp = {
  runtime: SourcefedDaemon["runtime"]
  handler: ReturnType<typeof createMcpHandler>
  close(): void
}

export type SourcefedStdio = {
  runtime: SourcefedDaemon["runtime"]
  factory: () => McpServer
  close(): void
}

export function createSourcefedMcp(daemon: SourcefedDaemon): SourcefedMcp {
  const handler = createMcpHandler(() => buildServer(daemon), { legacy: "stateless" })
  const unobserve = daemon.observe((target) => handler.notify.resourceUpdated(eventResourceUri(target)))

  return {
    runtime: daemon.runtime,
    handler,
    close: async () => {
      unobserve()
      await daemon.stop()
    },
  }
}

export function createSourcefedStdio(daemon: SourcefedDaemon): SourcefedStdio {
  const servers = new Set<McpServer>()
  const unobserve = daemon.observe((target) => {
    const uri = eventResourceUri(target)
    for (const server of servers) {
      void server.server.sendResourceUpdated({ uri }).catch(() => {})
    }
  })

  return {
    runtime: daemon.runtime,
    factory: () => {
      const server = buildServer(daemon)
      servers.add(server)
      return server
    },
    close: async () => {
      unobserve()
      await daemon.stop()
      servers.clear()
    },
  }
}

function buildServer(daemon: SourcefedDaemon): McpServer {
  const targetSchema = z.object({ kind: z.string().min(1), id: z.string().min(1) })
  const sourceTypeSchema = z.enum(daemon.sourceTypes as [string, ...string[]])
  const createSchema = z.object({
    name: z.string().min(1),
    sourceType: sourceTypeSchema,
    issueKey: z.string().optional(),
    repo: z.string().optional(),
    prNumber: z.number().int().positive().optional(),
    channelId: z.string().optional(),
    threadTs: z.string().optional(),
    threadUrl: z.string().optional(),
    pollIntervalSec: z.number().min(15).optional(),
    target: targetSchema,
  })
  const scopedSchema = z.object({ target: targetSchema })
  const statusSchema = z.object({ target: targetSchema, id: z.string().min(1) })
  const ackSchema = z.object({ target: targetSchema, eventIDs: z.array(z.string().min(1)).min(1) })

  const server = new McpServer(
    { name: "sourcefed", version: "0.2.0" },
    { capabilities: { resources: { subscribe: true } } },
  )

  server.registerTool(
    "monitor_create",
    {
      description: "Create or reuse a monitor for a Jira issue, GitHub pull request, or Slack thread.",
      inputSchema: createSchema,
      annotations: { idempotentHint: true, readOnlyHint: false },
    },
    async (input) => {
      const result = await daemon.createMonitor(input.target, input as unknown as DaemonCreateInput)
      if (!result.ok) return errorResult(result.error)
      return jsonResult({ ok: true, created: result.created, monitor: result.monitor })
    },
  )

  server.registerTool(
    "monitor_list",
    {
      description: "List active and stopped monitors for a target.",
      inputSchema: scopedSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ target }) => {
      const result = await daemon.listMonitors(target)
      return jsonResult({ monitors: result.ok ? result.monitors : [] })
    },
  )

  server.registerTool(
    "monitor_status",
    {
      description: "Read one monitor owned by a target.",
      inputSchema: statusSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ target, id }) => {
      const result = await daemon.getMonitor(target, id)
      if (!result.ok) return errorResult(result.error)
      return jsonResult({ monitor: result.monitor })
    },
  )

  server.registerTool(
    "monitor_stop",
    {
      description: "Stop one monitor owned by a target.",
      inputSchema: statusSchema,
      annotations: { destructiveHint: true, readOnlyHint: false },
    },
    async ({ target, id }) => {
      const result = await daemon.stopMonitor(target, id)
      if (!result.ok) return errorResult(result.error)
      return jsonResult({ monitor: result.monitor })
    },
  )

  server.registerTool(
    "monitor_start",
    {
      description: "Start (re-enable) a stopped monitor owned by a target.",
      inputSchema: statusSchema,
      annotations: { destructiveHint: true, readOnlyHint: false, idempotentHint: true },
    },
    async ({ target, id }) => {
      const result = await daemon.startMonitor(target, id)
      if (!result.ok) return errorResult(result.error)
      return jsonResult({ monitor: result.monitor })
    },
  )

  server.registerTool(
    "monitor_events_ack",
    {
      description: "Acknowledge monitor events after the host has delivered them.",
      inputSchema: ackSchema,
      annotations: { destructiveHint: true, readOnlyHint: false, idempotentHint: true },
    },
    async ({ target, eventIDs }) => {
      const result = await daemon.acknowledgeEvents(target, eventIDs)
      return jsonResult({ ok: result.ok, acknowledged: result.ok ? result.acknowledged : eventIDs })
    },
  )

  server.registerResource(
    "target-events",
    new ResourceTemplate("sourcefed://targets/{targetId}/events", { list: undefined }),
    {
      title: "Sourcefed monitor events",
      description: "Pending monitor events for one host target.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const target = decodeTarget(String(variables.targetId))
      if (!target) throw new Error("invalid Sourcefed target resource")
      const events = await daemon.readEvents(target)
      return {
        contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ events }) }],
      }
    },
  )

  return server
}

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value }
}

function errorResult(error: string) {
  return { content: [{ type: "text" as const, text: error }], isError: true }
}
