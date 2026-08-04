import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio"
import os from "node:os"
import path from "node:path"
import type { MonitorTarget, QueuedMonitorEvent } from "@sourcefed/core"
import { eventResourceUri } from "./uris.ts"

type ResourceListener = () => Promise<void>
const resourceListeners = new WeakMap<Client, Map<string, Set<ResourceListener>>>()
const resourceQueues = new WeakMap<Client, Map<string, Promise<void>>>()

export type SourcefedClientOptions = {
  name: string
  version?: string
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
}

export function localDaemonEnvironment(host: string, legacyStateFile?: string): Record<string, string> {
  const environment = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined))
  environment.SOURCEFED_STATE_DIR ??= path.join(process.env.XDG_STATE_HOME ?? path.join(os.homedir(), ".local", "state"), "sourcefed", host)
  if (legacyStateFile) environment.SOURCEFED_LEGACY_STATE_FILE ??= legacyStateFile
  return environment
}

export function localMcpCommand(cliEntryPath: string): { command: string; args: string[] } {
  if (process.env.SOURCEFED_MCP_COMMAND) return { command: process.env.SOURCEFED_MCP_COMMAND, args: ["mcp", "--stdio"] }
  return {
    command: "bun",
    args: [cliEntryPath, "mcp", "--stdio"],
  }
}

export async function connectSourcefedClient(options: SourcefedClientOptions): Promise<Client> {
  const client = new Client(
    { name: options.name, version: options.version ?? "0.2.0" },
    { versionNegotiation: { mode: "auto" } },
  )
  if (options.url) {
    await client.connect(new StreamableHTTPClientTransport(new URL(options.url)))
  } else {
    await client.connect(new StdioClientTransport({
      command: options.command ?? "sourcefed",
      args: options.args ?? ["mcp", "--stdio"],
      env: options.env,
    }))
  }
  return client
}

export async function listenForTarget(
  client: Client,
  target: MonitorTarget,
  onEvents: (events: QueuedMonitorEvent[]) => Promise<void>,
): Promise<{ close(): Promise<void> }> {
  const uri = eventResourceUri(target)
  let listeners = resourceListeners.get(client)
  if (!listeners) {
    listeners = new Map()
    resourceListeners.set(client, listeners)
    client.setNotificationHandler("notifications/resources/updated", async (notification) => {
      const callbacks = resourceListeners.get(client)?.get(notification.params.uri)
      if (!callbacks) return
      await Promise.all([...callbacks].map((callback) => enqueueResourceRead(client, notification.params.uri, callback)))
    })
  }
  const callback = readAndDeliver
  const callbacks = listeners.get(uri) ?? new Set<ResourceListener>()
  callbacks.add(callback)
  listeners.set(uri, callbacks)
  let subscription: Awaited<ReturnType<Client["listen"]>>
  try {
    subscription = await client.listen({ resourceSubscriptions: [uri] })
    await enqueueResourceRead(client, uri, readAndDeliver)
  } catch (error) {
    callbacks.delete(callback)
    if (callbacks.size === 0) listeners.delete(uri)
    throw error
  }
  return {
    close: async () => {
      callbacks.delete(callback)
      if (callbacks.size === 0) listeners?.delete(uri)
      await subscription.close()
    },
  }

  async function readAndDeliver(): Promise<void> {
    try {
      const result = await client.readResource({ uri })
      const text = result.contents.find((content) => "text" in content)?.text
      if (typeof text !== "string") return
      const parsed: unknown = JSON.parse(text)
      if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { events?: unknown }).events)) return
      const events = (parsed as { events: QueuedMonitorEvent[] }).events
      if (events.length === 0) return
      await onEvents(events)
      await client.callTool({
        name: "monitor_events_ack",
        arguments: { target, eventIDs: events.map((event) => event.id) },
      })
    } catch (error) {
      console.error(`[sourcefed] event resource delivery failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

function enqueueResourceRead(client: Client, uri: string, callback: ResourceListener): Promise<void> {
  let queues = resourceQueues.get(client)
  if (!queues) {
    queues = new Map()
    resourceQueues.set(client, queues)
  }
  const previous = queues.get(uri) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(callback)
  queues.set(uri, next)
  void next.then(
    () => {
      if (queues?.get(uri) === next) queues.delete(uri)
    },
    () => {
      if (queues?.get(uri) === next) queues.delete(uri)
    },
  )
  return next
}

export function parseToolResult(result: unknown): unknown {
  if (!result || typeof result !== "object") return result
  const structured = (result as { structuredContent?: unknown }).structuredContent
  if (structured !== undefined) return structured
  const text = (result as { content?: Array<{ type?: string; text?: string }> }).content?.find((part) => part.type === "text")?.text
  if (!text) return result
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
