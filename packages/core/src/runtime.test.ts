import assert from "node:assert/strict"
import { describe, test } from "node:test"
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
    assert.deepEqual(await runtime.service.list(), [])
    await runtime.stop()
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
    assert.equal(ticks, 1)
  })
})
