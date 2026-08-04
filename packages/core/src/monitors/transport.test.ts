import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { InMemoryMonitorEventQueue, QueueMonitorEventSink } from "../events.ts"
import type { MonitorContext, MonitorEvent, MonitorEventSink } from "#sourcefed/types"
import { InMemoryMonitorStore } from "../storage/in-memory-monitor-store.ts"
import { Monitor, MonitorService, PollMonitor, WebhookMonitor } from "#sourcefed/monitors"
import type { MonitorRecord } from "#sourcefed/monitors"

type TestSource = { type: "test"; key: string }
const testSourceSchema = v.object({ type: v.literal("test"), key: v.string() })

class TestMonitor extends Monitor<TestSource> {
  readonly key = (source: TestSource): string => source.key
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

    expect(monitor.resolveDelivery(current)).toBe("webhook")
    expect(monitor.resolveDelivery({ ...current, delivery: "webhook" })).toBe("webhook")
    const stale = { ...current, delivery: "webhook" as const, cursors: { __webhookHeartbeatAt: Date.now() - 120_000 } }
    expect(monitor.resolveDelivery(stale)).toBe("poll")
    expect(monitor.resolveDelivery({ ...stale, delivery: "poll" })).toBe("poll")
  })

  test("routes poll events once and persists the source cursor", async () => {
    const service = new MonitorService(new InMemoryMonitorStore())
    const source = { type: "test" as const, key: "issue-1" }
    const monitor = new TestMonitor(async () => ({ cursor: { seen: true }, events: [event(source)] }))
    const delivered: MonitorEvent[] = []
    const sink: MonitorEventSink = { deliver: async ({ event: next }) => { delivered.push(next); return { ok: true } } }
    const record = await createRecord(service)

    expect(await monitor.poll.run(context(service, sink), monitor, record)).toBe(1)
    expect(delivered).toHaveLength(1)
    expect((await service.get(record.id))?.cursors[source.key]).toEqual({ seen: true })
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
    expect(await monitor.poll.run(context(service, sink), monitor, record)).toBe(0)
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

    expect(await monitor.webhook.deliver(current, monitor, record, event({ type: "test", key: "other" }), "wrong")).toBe(0)
    expect(await monitor.webhook.deliver(current, monitor, record, event({ type: "test", key: "issue-1" }), "delivery-1")).toBe(0)
    shouldSucceed = true
    expect(await monitor.webhook.retryPending(current, monitor, record)).toBe(1)
    expect(delivered).toHaveLength(1)
    expect((await service.get(record.id))?.cursors["webhook:delivery-1"]).toBe(true)
  })
})
