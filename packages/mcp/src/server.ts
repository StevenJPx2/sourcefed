import { createMcpHandler, McpServer, ResourceTemplate } from "@modelcontextprotocol/server"
import * as z from "zod/v4"
import {
  MonitorRuntime,
  MonitorService,
  type MonitorTarget,
  type MonitorEventQueue,
  type MonitorRecord,
  type MonitorStore,
} from "@sourcefed/core"
import { isSource, SOURCE_MAP, SOURCE_TYPES, sourceDefinition, sourceForInput, sourceForWebhookPath } from "@sourcefed/providers"
import { JsonMonitorEventQueue, JsonMonitorStore } from "@sourcefed/store"
import { NotifyingEventSink } from "./events.ts"
import { decodeTarget, eventResourceUri } from "./uris.ts"

const targetSchema = z.object({ kind: z.string().min(1), id: z.string().min(1) })
const sourceTypeSchema = z.enum(SOURCE_TYPES)
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

export type SourcefedMcpOptions = {
  store?: MonitorStore
  eventQueue?: MonitorEventQueue
  stateDir?: string
  legacyStateFile?: string
  pollLoopSec?: number
}

export type SourcefedMcp = {
  runtime: MonitorRuntime
  handler: ReturnType<typeof createMcpHandler>
  queue: MonitorEventQueue
  close(): void
}

export type SourcefedStdio = {
  runtime: MonitorRuntime
  factory: () => McpServer
  close(): void
}

export function createSourcefedMcp(options: SourcefedMcpOptions = {}): SourcefedMcp {
  const store = options.store ?? new JsonMonitorStore({ stateDir: options.stateDir, legacyStateFile: options.legacyStateFile })
  const queue = options.eventQueue ?? new JsonMonitorEventQueue(options.stateDir ?? new JsonMonitorStore({ stateDir: options.stateDir }).stateDir)
  let notifyTarget: (target: MonitorTarget) => void = () => {}
  const sink = new NotifyingEventSink(queue, (target) => notifyTarget(target))
  const runtime = new MonitorRuntime({
    store,
    sink,
    sources: SOURCE_MAP,
    sourceForWebhookPath,
    pollLoopSec: options.pollLoopSec,
  })
  const handler = createMcpHandler(() => buildServer(runtime.service, queue), { legacy: "stateless" })
  notifyTarget = (target) => handler.notify.resourceUpdated(eventResourceUri(target))

  return {
    runtime,
    handler,
    queue,
    close: () => runtime.stop(),
  }
}

export function createSourcefedStdio(options: SourcefedMcpOptions = {}): SourcefedStdio {
  const store = options.store ?? new JsonMonitorStore({ stateDir: options.stateDir, legacyStateFile: options.legacyStateFile })
  const queue = options.eventQueue ?? new JsonMonitorEventQueue(options.stateDir ?? new JsonMonitorStore({ stateDir: options.stateDir }).stateDir)
  const servers = new Set<McpServer>()
  const sink = new NotifyingEventSink(queue, (target) => {
    const uri = eventResourceUri(target)
    for (const server of servers) {
      void server.server.sendResourceUpdated({ uri }).catch(() => {})
    }
  })
  const runtime = new MonitorRuntime({
    store,
    sink,
    sources: SOURCE_MAP,
    sourceForWebhookPath,
    pollLoopSec: options.pollLoopSec,
  })

  return {
    runtime,
    factory: () => {
      const server = buildServer(runtime.service, queue)
      servers.add(server)
      return server
    },
    close: () => {
      runtime.stop()
      servers.clear()
    },
  }
}

function buildServer(service: MonitorService, queue: MonitorEventQueue): McpServer {
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
      const source = sourceForInput(input.sourceType, input)
      if (!isSource(source)) return errorResult((source as { error: string }).error)
      const definition = sourceDefinition(source)
      const result = await service.create({
        name: input.name,
        source,
        delivery: definition.initialDelivery(source),
        target: input.target,
        pollIntervalSec: input.pollIntervalSec ?? 60,
      })
      return jsonResult({ ok: true, created: result.created, monitor: monitorView(result.monitor) })
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
      const monitors = (await service.list()).filter((monitor) => sameTarget(monitor.target, target))
      return jsonResult({ monitors: monitors.map(monitorView) })
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
      const monitor = await ownedMonitor(service, id, target)
      if (!monitor) return errorResult(`monitor ${id} was not found for this target`)
      return jsonResult({ monitor: monitorView(monitor) })
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
      const monitor = await ownedMonitor(service, id, target)
      if (!monitor) return errorResult(`monitor ${id} was not found for this target`)
      const stopped = await service.stop(id)
      if ("error" in stopped) return errorResult(stopped.error)
      return jsonResult({ monitor: monitorView(stopped) })
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
      await queue.acknowledge(target, eventIDs)
      return jsonResult({ ok: true, acknowledged: eventIDs })
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
      const events = await queue.read(target)
      return {
        contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ events }) }],
      }
    },
  )

  return server
}

function monitorView(monitor: MonitorRecord) {
  return {
    id: monitor.id,
    name: monitor.name,
    source: monitor.source,
    target: monitor.target,
    delivery: monitor.delivery,
    pollIntervalSec: monitor.pollIntervalSec,
    enabled: monitor.enabled,
    createdAt: monitor.createdAt,
    updatedAt: monitor.updatedAt,
  }
}

async function ownedMonitor(service: MonitorService, id: string, target: MonitorTarget): Promise<MonitorRecord | undefined> {
  const monitor = await service.get(id)
  return monitor && sameTarget(monitor.target, target) ? monitor : undefined
}

function sameTarget(left: MonitorTarget, right: MonitorTarget): boolean {
  return left.kind === right.kind && left.id === right.id
}

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value }
}

function errorResult(error: string) {
  return { content: [{ type: "text" as const, text: error }], isError: true }
}
