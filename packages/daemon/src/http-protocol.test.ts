import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { InMemoryMonitorEventQueue, InMemoryMonitorStore } from "@sourcefed/core"
import { serveHttp } from "@sourcefed/daemon"
import { SourcefedDaemon } from "./daemon.ts"
import { handleDaemonHttpRequest } from "./http.ts"

// The protocol as docs/program-targets.md gives it to programs: plain HTTP, no sourcefed client.
const target = { kind: "program", id: "atelier" }
const encodedTarget = Buffer.from(JSON.stringify(target)).toString("base64url")
type Frame = { type: string; events?: Array<{ id: string; event: { kind: string } }> }

describe("the HTTP protocol for programs", () => {
  test("health, create, hold /events, redelivery before ack, nothing after", async () => {
    const daemon = new SourcefedDaemon({ store: new InMemoryMonitorStore(), eventQueue: new InMemoryMonitorEventQueue() })
    const server = await serveHttp({ hostname: "127.0.0.1", port: 0, handler: (request: Request) => handleDaemonHttpRequest(daemon, request) })
    const base = `http://127.0.0.1:${server.port}`
    const rpc = async (method: string, params: Record<string, unknown> = {}) => {
      const response = await fetch(`${base}/rpc`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: 1, method, params }) })
      assert.equal(response.status, 200)
      return ((await response.json()) as { result: unknown }).result
    }

    try {
      assert.deepEqual(Object.keys(await rpc("daemon.health") as object), ["ok", "version", "protocol"])
      const created = await rpc("monitor.create", { target, name: "PROJ-1", sourceType: "jira", issueKey: "PROJ-1" }) as { monitor: { id: string } }
      assert.equal((await rpc("monitor.list", { target }) as { monitors: unknown[] }).monitors.length, 1)

      const record = await daemon.service.get(created.monitor.id)
      if (!record) throw new Error("monitor record not found")
      await daemon.runtime.context.sink.deliver({
        monitor: record,
        event: { source: record.source, kind: "item.matched", id: "item:PROJ-1", at: "2026-11-13T10:00:00.000Z", summary: "PROJ-1", actionable: true },
      })

      const first = await eventsFrom(base)
      assert.deepEqual(first.map((queued) => queued.event.kind), ["item.matched"])
      const again = await eventsFrom(base)
      assert.deepEqual(again.map((queued) => queued.id), first.map((queued) => queued.id), "an unacknowledged event comes again on reconnect")

      assert.deepEqual(await rpc("monitor.ack", { target, eventIDs: first.map((queued) => queued.id) }), { ok: true, acknowledged: first.map((queued) => queued.id) })
      assert.deepEqual(await eventsFrom(base, 300), [], "an acknowledged event is gone")
    } finally {
      await server.stop()
      await daemon.stop()
    }
  })
})

/** Open /events, read frames until one carries events or `quietMs` passes, then close the stream. */
async function eventsFrom(base: string, quietMs = 3_000): Promise<NonNullable<Frame["events"]>> {
  const controller = new AbortController()
  const response = await fetch(`${base}/events?target=${encodedTarget}`, { signal: controller.signal })
  assert.equal(response.headers.get("content-type"), "text/event-stream")
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader()
  const timer = setTimeout(() => controller.abort(), quietMs)
  let buffer = ""
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) return []
      buffer += value
      for (const block of buffer.split("\n\n").slice(0, -1)) {
        if (!block.startsWith("data: ")) continue
        const frame = JSON.parse(block.slice(6)) as Frame
        if (frame.type === "event") return frame.events ?? []
      }
      buffer = buffer.slice(buffer.lastIndexOf("\n\n") + 2)
    }
  } catch (error) {
    if (controller.signal.aborted) return []
    throw error
  } finally {
    clearTimeout(timer)
    controller.abort()
  }
}
