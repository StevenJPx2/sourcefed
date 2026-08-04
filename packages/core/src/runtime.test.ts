import { describe, expect, test } from "bun:test"
import { InMemoryMonitorEventQueue, QueueMonitorEventSink } from "./events.ts"
import { MonitorRuntime } from "./runtime.ts"
import { InMemoryMonitorStore } from "./storage/in-memory-monitor-store.ts"

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
})
