import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { InMemoryMonitorEventQueue, InMemoryMonitorStore, type MonitorRecord, type MonitorTarget, type QueuedMonitorEvent } from "@sourcefed/core"
import { SourcefedDaemon } from "@sourcefed/daemon"
import { createSourcefedMcp } from "./server.ts"
import { eventResourceUri } from "./uris.ts"

function createDaemon(): SourcefedDaemon {
  return new SourcefedDaemon({
    store: new InMemoryMonitorStore(),
    eventQueue: new InMemoryMonitorEventQueue(),
  })
}

describe("Sourcefed MCP", () => {
  test("routes a queued event through modern resource subscriptions", async () => {
    const target = { kind: "test", id: "session-1" }
    const daemon = createDaemon()
    const mcp = createSourcefedMcp(daemon)
    const client = new Client({ name: "sourcefed-test", version: "0.0.0" }, { versionNegotiation: { mode: "auto" } })
    const transport = new StreamableHTTPClientTransport(new URL("http://sourcefed.test/mcp"), {
      fetch: (url, init) => mcp.handler.fetch(new Request(url, init)),
    })

    await client.connect(transport)
    const created = parseToolResult(await client.callTool({
      name: "monitor_create",
      arguments: {
        name: "ADEPT-43742",
        sourceType: "jira",
        issueKey: "ADEPT-43742",
        target,
      },
    })) as { monitor: MonitorRecord }
    assert.deepEqual(created.monitor.target, target)

    const received = new Promise<string>((resolve, reject) => {
      listenForTarget(client, target, async (events) => {
        try {
          resolve(events[0].event.summary)
        } catch (error) {
          reject(error)
        }
      }).catch((error) => {
        reject(error)
      })
    })

    const record = await daemon.service.get(created.monitor.id)
    if (!record) throw new Error("monitor record not found")
    await daemon.runtime.context.sink.deliver({
      monitor: record,
      event: {
        source: record.source,
        kind: "comment",
        id: "comment:1",
        at: "2026-08-04T12:00:00.000Z",
        summary: "Jira ADEPT-43742 comment by Steven John",
        body: "thanks for flagging this",
        actionable: true,
      },
    })

    assert.equal(await received, "Jira ADEPT-43742 comment by Steven John")
    await client.close()
    mcp.close()
  })

  test("reuses a monitor for the same target and source", async () => {
    const daemon = createDaemon()
    const mcp = createSourcefedMcp(daemon)
    const client = new Client({ name: "sourcefed-test", version: "0.0.0" }, { versionNegotiation: { mode: "auto" } })
    const transport = new StreamableHTTPClientTransport(new URL("http://sourcefed.test/mcp"), {
      fetch: (url, init) => mcp.handler.fetch(new Request(url, init)),
    })
    await client.connect(transport)

    const args = {
      name: "ADEPT-43742",
      sourceType: "jira",
      issueKey: "ADEPT-43742",
      target: { kind: "test", id: "session-1" },
    }
    const first = parseToolResult(await client.callTool({ name: "monitor_create", arguments: args })) as { created: boolean; monitor: MonitorRecord }
    const second = parseToolResult(await client.callTool({ name: "monitor_create", arguments: args })) as { created: boolean; monitor: MonitorRecord }
    assert.equal(first.created, true)
    assert.equal(second.created, false)
    assert.equal(second.monitor.id, first.monitor.id)

    await client.close()
    mcp.close()
  })

  test("stops only a monitor owned by the requested target", async () => {
    const daemon = createDaemon()
    const mcp = createSourcefedMcp(daemon)
    const client = new Client({ name: "sourcefed-test", version: "0.0.0" }, { versionNegotiation: { mode: "auto" } })
    const transport = new StreamableHTTPClientTransport(new URL("http://sourcefed.test/mcp"), {
      fetch: (url, init) => mcp.handler.fetch(new Request(url, init)),
    })
    await client.connect(transport)

    const target = { kind: "test", id: "session-1" }
    const created = parseToolResult(await client.callTool({
      name: "monitor_create",
      arguments: { name: "ADEPT-43742", sourceType: "jira", issueKey: "ADEPT-43742", target },
    })) as { monitor: MonitorRecord }
    const unauthorized = await client.callTool({
      name: "monitor_stop",
      arguments: { target: { kind: "other", id: "session-2" }, id: created.monitor.id },
    })
    const unauthorizedResult = parseToolResult(unauthorized)
    assert.ok(typeof unauthorizedResult === "string" && unauthorizedResult.includes("not found"))

    const stopped = parseToolResult(await client.callTool({
      name: "monitor_stop",
      arguments: { target, id: created.monitor.id },
    })) as { monitor: MonitorRecord }
    assert.equal(stopped.monitor.enabled, false)

    await client.close()
    mcp.close()
  })
})

const resourceListeners = new WeakMap<Client, Map<string, Set<() => Promise<void>>>>()
const resourceQueues = new WeakMap<Client, Map<string, Promise<void>>>()

async function listenForTarget(
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
  const callbacks = listeners.get(uri) ?? new Set<() => Promise<void>>()
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
      if (callbacks.size === 0) {
        listeners.delete(uri)
        resourceQueues.get(client)?.delete(uri)
      }
      await subscription.close()
    },
  }

  async function readAndDeliver(): Promise<void> {
    const result = await client.readResource({ uri })
    const text = (result as { contents: Array<{ text?: string }> }).contents?.find((content) => "text" in content)?.text
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
  }
}

function enqueueResourceRead(client: Client, uri: string, callback: () => Promise<void>): Promise<void> {
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

function parseToolResult(result: unknown): unknown {
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
