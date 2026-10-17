import assert from "node:assert/strict"
import { test, type TestContext } from "node:test"
import { InMemoryMonitorEventQueue, InMemoryMonitorStore, type QueuedMonitorEvent } from "@sourcefed/core"
import { serveHttp } from "./utils"
import { connectDaemonClient } from "./client.ts"
import { SourcefedDaemon } from "./daemon.ts"
import { handleDaemonHttpRequest } from "./http.ts"

const target = { kind: "test", id: "session_lifecycle" }
const queued: QueuedMonitorEvent = {
  id: "evt_lifecycle", monitorID: "mon_lifecycle", target,
  event: { source: { type: "github" }, kind: "ci", at: "2026-09-25T00:00:00Z", summary: "CI failed", actionable: true },
} as QueuedMonitorEvent
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function until(check: () => boolean | Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 3_000
  while (!(await check()) && Date.now() < deadline) await delay(10)
  assert.ok(await check(), "condition did not become true")
}

async function http(t: TestContext, handler: (request: Request) => Response | Promise<Response>) {
  const server = await serveHttp({ hostname: "127.0.0.1", port: 0, handler })
  const client = await connectDaemonClient({ name: "stream-lifecycle-test", url: `http://127.0.0.1:${server.port}` })
  t.after(async () => { await client.close(); await server.stop() })
  return client
}

function pendingStream() {
  let active = 0
  let opened = 0
  const handler = () => {
    opened += 1
    return new Response(new ReadableStream<Uint8Array>({
      start(controller) { active += 1; controller.enqueue(new TextEncoder().encode(": waiting\n\n")) },
      cancel() { active -= 1 },
    }), { headers: { "content-type": "text/event-stream" } })
  }
  return { handler, active: () => active, opened: () => opened }
}

test("abort during SSE setup rejects promptly and releases the real HTTP stream", async (t) => {
  const fixture = pendingStream()
  const client = await http(t, fixture.handler)
  const controller = new AbortController()
  const subscribing = client.subscribe(target, async () => {}, { signal: controller.signal })
  const rejected = assert.rejects(subscribing, /closed/)
  await until(() => fixture.active() === 1)
  controller.abort()
  await rejected
  await until(() => fixture.active() === 0)
  await delay(550)
  assert.equal(fixture.opened(), 1, "cancelled setup must not reconnect")
})

test("client close cancels pending setup and rejects new subscriptions", async (t) => {
  const fixture = pendingStream()
  const client = await http(t, fixture.handler)
  const subscribing = client.subscribe(target, async () => {})
  const rejected = assert.rejects(subscribing, /closed/)
  await until(() => fixture.active() === 1)
  await client.close()
  await rejected
  await until(() => fixture.active() === 0)
  await assert.rejects(client.subscribe(target, async () => {}), /closed/)
  await assert.rejects(client.request("monitor.list", { target }), /closed/)
})

test("an already-aborted subscription never opens a connection", async (t) => {
  const fixture = pendingStream()
  const client = await http(t, fixture.handler)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(client.subscribe(target, async () => {}, { signal: controller.signal }), /closed/)
  assert.equal(fixture.opened(), 0)
})

test("setup retries recover over HTTP without leaving failed response bodies open", async (t) => {
  let attempts = 0
  let active = 0
  const client = await http(t, () => {
    if (++attempts === 1) return new Response("try again", { status: 503 })
    return new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        active += 1
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "subscribed", target })}\n\n`))
      },
      cancel() { active -= 1 },
    }), { headers: { "content-type": "text/event-stream" } })
  })
  const listener = await client.subscribe(target, async () => {})
  assert.equal(attempts, 2)
  assert.equal(active, 1)
  await listener.close()
  await until(() => active === 0)
})

test("reconnect waits for an in-flight acknowledgement instead of delivering twice", async (t) => {
  const ackStarted = Promise.withResolvers<void>()
  const releaseAck = Promise.withResolvers<void>()
  let opens = 0
  let queuedEvent = true
  let deliveries = 0
  const client = await http(t, async (request) => {
    if (new URL(request.url).pathname === "/rpc") {
      ackStarted.resolve()
      await releaseAck.promise
      queuedEvent = false
      return Response.json({ result: { ok: true } })
    }
    opens += 1
    return new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        const frames = [{ type: "subscribed", target }]
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(frames[0])}\n\n`))
        if (queuedEvent) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "event", target, events: [queued] })}\n\n`))
        controller.close() // A network EOF while the ack RPC is still pending.
      },
    }), { headers: { "content-type": "text/event-stream" } })
  })
  const listener = await client.subscribe(target, async () => { deliveries += 1 })
  try {
    await ackStarted.promise
    await delay(600)
    assert.equal(opens, 1)
    releaseAck.resolve()
    await until(() => opens >= 2)
    assert.equal(deliveries, 1)
  } finally { releaseAck.resolve(); await listener.close() }
})

test("closing an active stream drains delivery and ack before handing off its claim", async (t) => {
  const daemon = new SourcefedDaemon({ store: new InMemoryMonitorStore(), eventQueue: new InMemoryMonitorEventQueue() })
  const client = await http(t, (request) => handleDaemonHttpRequest(daemon, request))
  const created = await daemon.createMonitor(target, { name: "test", sourceType: "jira", issueKey: "TEST-1" })
  assert.ok("monitor" in created && created.monitor)
  const record = await daemon.service.get(created.monitor.id)
  assert.ok(record)
  const delivering = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const listener = await client.subscribe(target, async () => { delivering.resolve(); await release.promise })
  await daemon.runtime.context.sink.deliver({ monitor: record, event: { ...queued.event, source: record.source } })
  await delivering.promise
  let closed = false
  const closing = listener.close().then(() => { closed = true })
  await delay(20)
  assert.equal(closed, false)
  release.resolve()
  await closing
  assert.equal((await daemon.readEvents(target)).length, 0)
  let replayed = 0
  const replacement = await client.subscribe(target, async (events) => { replayed += events.length })
  await delay(50)
  await replacement.close()
  assert.equal(replayed, 0)
})

test("forced close releases HTTP and stops reconnecting when a callback does not settle", { timeout: 20_000 }, async (t) => {
  const started = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  let active = 0
  let opened = 0
  let acknowledgements = 0
  const client = await http(t, (request) => {
    if (new URL(request.url).pathname === "/rpc") {
      acknowledgements += 1
      return Response.json({ result: { ok: true } })
    }
    opened += 1
    return new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        active += 1
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "subscribed", target })}\n\n`))
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "event", target, events: [queued] })}\n\n`))
      },
      cancel() { active -= 1 },
    }), { headers: { "content-type": "text/event-stream" } })
  })
  const listener = await client.subscribe(target, async () => { started.resolve(); await release.promise })
  try {
    await started.promise
    await listener.close()
    await until(() => active === 0)
    release.resolve()
    await delay(550)
    assert.equal(opened, 1)
    assert.equal(acknowledgements, 0, "timed-out work remains unacknowledged for retry")
  } finally { release.resolve() }
})
