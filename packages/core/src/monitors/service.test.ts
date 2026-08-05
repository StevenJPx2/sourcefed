import assert from "node:assert/strict"
import { describe, test } from "node:test"
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

    assert.equal(created.created, true)
    assert.equal(reused.created, false)
    assert.equal(reused.monitor.id, created.monitor.id)
    assert.equal(created.monitor.pollIntervalSec, 15)

    const reordered = await service.create({
      ...input,
      source: { key: "issue-1", type: "test" },
    })
    assert.equal(reordered.created, false)

    assert.equal((await service.list()).length, 1)

    const stopped = await service.stop(created.monitor.id)
    assert.equal("error" in stopped ? stopped : stopped.enabled, false)
    assert.partialDeepStrictEqual(await service.get(created.monitor.id), { enabled: false })

    await service.remove(created.monitor.id)
    assert.equal(await service.get(created.monitor.id), undefined)
  })
})
