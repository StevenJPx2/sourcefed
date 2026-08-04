import { describe, expect, test } from "bun:test"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { InMemoryMonitorEventQueue, InMemoryMonitorStore, type MonitorRecord } from "@sourcefed/core"
import { createSourcefedMcp } from "./server.ts"
import { listenForTarget, parseToolResult } from "./client.ts"

describe("Sourcefed MCP", () => {
  test("routes a queued event through modern resource subscriptions", async () => {
    const target = { kind: "test", id: "session-1" }
    const queue = new InMemoryMonitorEventQueue()
    const mcp = createSourcefedMcp({
      store: new InMemoryMonitorStore(),
      eventQueue: queue,
    })
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
    expect(created.monitor.target).toEqual(target)

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

    await mcp.runtime.context.sink.deliver({
      monitor: created.monitor,
      event: {
        source: created.monitor.source,
        kind: "comment",
        id: "comment:1",
        at: "2026-08-04T12:00:00.000Z",
        summary: "Jira ADEPT-43742 comment by Steven John",
        body: "thanks for flagging this",
        actionable: true,
      },
    })

    await expect(received).resolves.toBe("Jira ADEPT-43742 comment by Steven John")
    await client.close()
    mcp.close()
  })

  test("reuses a monitor for the same target and source", async () => {
    const mcp = createSourcefedMcp({
      store: new InMemoryMonitorStore(),
      eventQueue: new InMemoryMonitorEventQueue(),
    })
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
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.monitor.id).toBe(first.monitor.id)

    await client.close()
    mcp.close()
  })

  test("stops only a monitor owned by the requested target", async () => {
    const mcp = createSourcefedMcp({
      store: new InMemoryMonitorStore(),
      eventQueue: new InMemoryMonitorEventQueue(),
    })
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
    expect(parseToolResult(unauthorized)).toContain("not found")

    const stopped = parseToolResult(await client.callTool({
      name: "monitor_stop",
      arguments: { target, id: created.monitor.id },
    })) as { monitor: MonitorRecord }
    expect(stopped.monitor.enabled).toBe(false)

    await client.close()
    mcp.close()
  })
})
