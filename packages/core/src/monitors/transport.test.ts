import assert from "node:assert/strict"
import { describe, test } from "node:test"
import * as v from "valibot"
import { InMemoryMonitorEventQueue, QueueMonitorEventSink } from "../events.ts"
import type { MonitorContext, MonitorEvent, MonitorEventSink } from "#sourcefed/types"
import { InMemoryMonitorStore } from "../storage/in-memory-monitor-store.ts"
import { Monitor, MonitorService, PollMonitor, WebhookMonitor } from "#sourcefed/monitors"
import { tick } from "./poll/utils/tick.ts"
import { handleWebhook } from "./webhook/utils/handle-webhook.ts"
import type { MonitorRecord } from "#sourcefed/monitors"

type TestSource = { type: "test"; key: string }
const testSourceSchema = v.object({ type: v.literal("test"), key: v.string() })

class TestMonitor extends Monitor<TestSource> {
  readonly key = (source: TestSource): string => source.key
  readonly input = { description: "A test source", properties: {}, required: [] }
  readonly icon = "?"
  readonly label = (source: TestSource): string => source.key
  readonly detail = (): string => ""
  readonly describe = (source: TestSource): string => `Test ${source.key}`
  readonly poll: PollMonitor<TestSource>
  readonly webhook: WebhookMonitor<TestSource>

  constructor(run: (source: TestSource, cursor: unknown) => Promise<{ cursor: unknown; events: MonitorEvent[] }>) {
    super({ type: "test", schema: testSourceSchema })
    this.poll = new PollMonitor({ run: async (source, cursor) => ({ ...(await run(source, cursor)), terminal: false }) })
    this.webhook = new WebhookMonitor<TestSource>({
      path: "/webhooks/test",
      configured: () => true,
      verify: () => true,
      deliveryId: () => "delivery-1",
      eventName: () => "test",
      parse: () => undefined,
    })
  }

  build(): { type: "test"; key: string } {
    return { type: "test", key: "test" }
  }
}

class PollOnlyMonitor extends Monitor<TestSource> {
  readonly key = (source: TestSource): string => source.key
  readonly input = { description: "A test source", properties: {}, required: [] }
  readonly icon = "?"
  readonly label = (source: TestSource): string => source.key
  readonly detail = (): string => ""
  readonly describe = (source: TestSource): string => `Test ${source.key}`
  readonly poll: PollMonitor<TestSource>

  readonly wake = {
    path: "/webhooks/test",
    matches: (source: TestSource, payload: unknown): boolean => (payload as { key?: string }).key === source.key,
  }

  constructor(run: () => Promise<{ cursor: unknown; events: MonitorEvent[] } | { deferred: true }>) {
    super({ type: "test", schema: testSourceSchema })
    this.poll = new PollMonitor({
      run: async () => {
        const result = await run()
        return "deferred" in result ? result : { ...result, terminal: false }
      },
    })
  }

  build(): { type: "test"; key: string } {
    return { type: "test", key: "test" }
  }
}

function event(source: TestSource, overrides: Partial<MonitorEvent> = {}): MonitorEvent {
  return {
    source,
    kind: "comment",
    id: "event-1",
    at: "2026-08-04T12:00:00.000Z",
    summary: "test event",
    actionable: true,
    ...overrides,
  }
}

function context(service: MonitorService, sink: MonitorEventSink): MonitorContext {
  return { service, sink, sources: {}, sourceForWebhookPath: () => undefined }
}

async function createRecord(service: MonitorService, delivery: "poll" | "webhook" = "poll"): Promise<MonitorRecord> {
  return (await service.create({
    name: "test",
    source: { type: "test", key: "issue-1" },
    delivery,
    target: { kind: "test", id: "session-1" },
    pollIntervalSec: 60,
  })).monitor
}

describe("Monitor transport orchestration", () => {
  test("resolves healthy and stale webhook/poll combinations", async () => {
    const service = new MonitorService(new InMemoryMonitorStore())
    const monitor = new TestMonitor(async () => ({ cursor: {}, events: [] }))
    const current = await createRecord(service)

    assert.equal(monitor.resolveDelivery(current), "webhook")
    assert.equal(monitor.resolveDelivery({ ...current, delivery: "webhook" }), "webhook")
    const stale = { ...current, delivery: "webhook" as const, cursors: { __webhookHeartbeatAt: Date.now() - 120_000 } }
    assert.equal(monitor.resolveDelivery(stale), "poll")
    assert.equal(monitor.resolveDelivery({ ...stale, delivery: "poll" }), "poll")
  })

  test("routes poll events once and persists the source cursor", async () => {
    const service = new MonitorService(new InMemoryMonitorStore())
    const source = { type: "test" as const, key: "issue-1" }
    const monitor = new TestMonitor(async () => ({ cursor: { seen: true }, events: [event(source)] }))
    const delivered: MonitorEvent[] = []
    const sink: MonitorEventSink = { deliver: async ({ event: next }) => { delivered.push(next); return { ok: true } } }
    const record = await createRecord(service)

    assert.equal(await monitor.poll.run(context(service, sink), monitor, record), 1)
    assert.equal(delivered.length, 1)
    assert.deepEqual((await service.get(record.id))?.cursors[source.key], { seen: true })
  })

  test("keeps the poll interval after a failed poll", async () => {
    const service = new MonitorService(new InMemoryMonitorStore())
    let polls = 0
    const monitor = new PollOnlyMonitor(async () => {
      polls += 1
      if (polls === 1) throw new Error("upstream unavailable")
      return { cursor: {}, events: [] }
    })
    const sink: MonitorEventSink = { deliver: async () => ({ ok: true }) }
    const current = { ...context(service, sink), sources: { test: monitor } }
    const record = await createRecord(service)

    await tick(current)
    await service.updateCursor(record, "__lastAttemptAt", Date.now() - 61_000)
    await tick(current)
    await tick(current)

    assert.equal(polls, 2)
  })

  test("a deferred poll keeps the cursor and stays due", async () => {
    const service = new MonitorService(new InMemoryMonitorStore())
    let polls = 0
    const monitor = new PollOnlyMonitor(async () => {
      polls += 1
      if (polls === 1) return { deferred: true }
      return { cursor: { seen: true }, events: [] }
    })
    const sink: MonitorEventSink = { deliver: async () => ({ ok: true }) }
    const current = { ...context(service, sink), sources: { test: monitor } }
    const record = await createRecord(service)
    await service.updateCursor(record, "issue-1", { seen: false })

    await tick(current)
    assert.deepEqual((await service.get(record.id))?.cursors, { "issue-1": { seen: false } })

    await tick(current)
    assert.equal(polls, 2)
    assert.deepEqual((await service.get(record.id))?.cursors["issue-1"], { seen: true })
  })

  test("a deferred monitor shows as unresponsive once its last read is ten windows old", async () => {
    const service = new MonitorService(new InMemoryMonitorStore())
    const monitor = new PollOnlyMonitor(async () => ({ deferred: true }))
    const sink: MonitorEventSink = { deliver: async () => ({ ok: true }) }
    const record = await createRecord(service)
    const readAgo = (ms: number): MonitorRecord => ({ ...record, cursors: { __lastPolledAt: Date.now() - ms } })
    // A 60-second interval gives a 3-minute unresponsive window and 30 minutes of grace.
    assert.equal(monitor.poll.isUnresponsive(readAgo(4 * 60_000), Date.now()), true, "not deferred")

    await monitor.poll.run(context(service, sink), monitor, record)
    assert.equal(monitor.poll.isUnresponsive(readAgo(4 * 60_000), Date.now()), false, "deferred, read 4 minutes ago")
    assert.equal(monitor.poll.isUnresponsive(readAgo(30 * 60_000), Date.now()), false, "deferred, read 30 minutes ago")
    assert.equal(monitor.poll.isUnresponsive(readAgo(31 * 60_000), Date.now()), true, "deferred, read 31 minutes ago")
  })

  test("a matching webhook wakes a poll before its interval", async () => {
    const service = new MonitorService(new InMemoryMonitorStore())
    let polls = 0
    const waking = new PollOnlyMonitor(async () => {
      polls += 1
      return { cursor: {}, events: [] }
    })
    const receiver = new TestMonitor(async () => ({ cursor: {}, events: [] }))
    const sink: MonitorEventSink = { deliver: async () => ({ ok: true }) }
    const current: MonitorContext = { ...context(service, sink), sources: { test: waking }, sourceForWebhookPath: () => receiver as unknown as Monitor }
    await createRecord(service)
    const delivery = (key: string) => new Request("http://daemon.test/webhooks/test", {
      method: "POST",
      body: JSON.stringify({ key }),
    })

    await tick(current)
    await handleWebhook(delivery("another-issue"), current)
    await tick(current)
    await handleWebhook(delivery("issue-1"), current)
    await tick(current)
    await tick(current)

    assert.equal(polls, 2)
  })

  test("prevents concurrent polls for the same monitor", async () => {
    const service = new MonitorService(new InMemoryMonitorStore())
    let release!: () => void
    let started!: () => void
    const waiting = new Promise<void>((resolve) => { release = resolve })
    const began = new Promise<void>((resolve) => { started = resolve })
    const source = { type: "test" as const, key: "issue-1" }
    const monitor = new TestMonitor(async () => {
      started()
      await waiting
      return { cursor: {}, events: [event(source)] }
    })
    const sink = new QueueMonitorEventSink(new InMemoryMonitorEventQueue())
    const record = await createRecord(service)
    const first = monitor.poll.run(context(service, sink), monitor, record)
    await began
    assert.equal(await monitor.poll.run(context(service, sink), monitor, record), 0)
    release()
    await first
  })

  test("rejects webhook events for another source and retries failed delivery", async () => {
    const service = new MonitorService(new InMemoryMonitorStore())
    const monitor = new TestMonitor(async () => ({ cursor: {}, events: [] }))
    const record = await createRecord(service, "webhook")
    let shouldSucceed = false
    const delivered: MonitorEvent[] = []
    const sink: MonitorEventSink = {
      deliver: async ({ event: next }) => {
        if (!shouldSucceed) return { ok: false, error: "offline" }
        delivered.push(next)
        return { ok: true }
      },
    }
    const current = context(service, sink)

    assert.equal(await monitor.webhook.deliver(current, monitor, record, event({ type: "test", key: "other" }), "wrong"), 0)
    assert.equal(await monitor.webhook.deliver(current, monitor, record, event({ type: "test", key: "issue-1" }), "delivery-1"), 0)
    shouldSucceed = true
    assert.equal(await monitor.webhook.retryPending(current, monitor, record), 1)
    assert.equal(delivered.length, 1)
    assert.equal((await service.get(record.id))?.cursors["webhook:delivery-1"], true)
  })
})
