import { describe, expect, test } from "bun:test"
import { InMemoryMonitorEventQueue, QueueMonitorEventSink } from "./events.ts"
import { MonitorRuntime } from "./runtime.ts"
import { InMemoryMonitorStore } from "./storage/in-memory-monitor-store.ts"
import type { Monitor } from "./monitors/monitor.ts"

describe("MonitorRuntime", () => {
  test("starts and stops an empty runtime", async () => {
    const runtime = new MonitorRuntime({
      store: new InMemoryMonitorStore(),
      sink: new QueueMonitorEventSink(new InMemoryMonitorEventQueue()),
      sources: {},
      sourceForWebhookPath: () => undefined,
      pollLoopSec: 60,
    })

    await runtime.start()
    expect(await runtime.service.list()).toEqual([])
    runtime.stop()
  })

  test("delegates tick work to the registered source", async () => {
    let ticks = 0
    const source = { tick: async () => { ticks += 1 } } as unknown as Monitor
    const runtime = new MonitorRuntime({
      store: new InMemoryMonitorStore(),
      sink: new QueueMonitorEventSink(new InMemoryMonitorEventQueue()),
      sources: { test: source },
      sourceForWebhookPath: () => undefined,
      pollLoopSec: 60,
    })
    await runtime.service.create({
      name: "test",
      source: { type: "test", key: "issue-1" },
      delivery: "poll",
      target: { kind: "test", id: "session-1" },
      pollIntervalSec: 60,
    })

    await runtime.tick()
    expect(ticks).toBe(1)
  })
})
