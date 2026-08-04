import { describe, expect, test } from "bun:test"
import { MonitorService } from "./service.ts"
import { InMemoryMonitorStore } from "../storage/in-memory-monitor-store.ts"

describe("MonitorService", () => {
  test("creates, reuses, stops, and removes monitors per target", async () => {
    const service = new MonitorService(new InMemoryMonitorStore())
    const input = {
      name: "test issue",
      source: { type: "test", key: "issue-1" },
      delivery: "poll" as const,
      target: { kind: "test", id: "session-1" },
      pollIntervalSec: 1,
    }

    const created = await service.create(input)
    const reused = await service.create({ ...input, name: "renamed" })

    expect(created.created).toBe(true)
    expect(reused.created).toBe(false)
    expect(reused.monitor.id).toBe(created.monitor.id)
    expect(created.monitor.pollIntervalSec).toBe(15)
    expect(await service.list()).toHaveLength(1)

    const stopped = await service.stop(created.monitor.id)
    expect("error" in stopped ? stopped : stopped.enabled).toBe(false)
    expect(await service.get(created.monitor.id)).toMatchObject({ enabled: false })

    await service.remove(created.monitor.id)
    expect(await service.get(created.monitor.id)).toBeUndefined()
  })
})
