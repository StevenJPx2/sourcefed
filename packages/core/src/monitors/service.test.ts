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

    const reenabled = await service.start(created.monitor.id)
    assert.equal("error" in reenabled ? reenabled : reenabled.enabled, true)
    assert.partialDeepStrictEqual(await service.get(created.monitor.id), { enabled: true })

    await service.remove(created.monitor.id)
    assert.equal(await service.get(created.monitor.id), undefined)
  })

  test("start rejects a stopped monitor whose identity is active again", async () => {
    const service = new MonitorService(new InMemoryMonitorStore())
    const input = {
      name: "first",
      source: { type: "test", key: "issue-1" },
      delivery: "poll" as const,
      target: { kind: "test", id: "session-1" },
      pollIntervalSec: 60,
    }

    const first = await service.create(input)
    await service.stop(first.monitor.id)
    const replacement = await service.create(input)
    assert.equal(replacement.created, true)

    const restarted = await service.start(first.monitor.id)
    assert.equal("error" in restarted, true, "starting the old monitor is rejected")
    assert.equal((await service.list()).filter((monitor) => monitor.enabled).length, 1)
  })
})
