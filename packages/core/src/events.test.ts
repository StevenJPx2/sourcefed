import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { InMemoryMonitorEventQueue } from "./events.ts"

const monitor = {
  id: "m-test",
  name: "test",
  source: { type: "test", key: "issue-1" },
  delivery: "poll" as const,
  target: { kind: "test", id: "session-1" },
  pollIntervalSec: 60,
  enabled: true,
  createdAt: "2026-08-04T12:00:00.000Z",
  updatedAt: "2026-08-04T12:00:00.000Z",
  cursors: {},
}

describe("InMemoryMonitorEventQueue", () => {
  test("deduplicates events and acknowledges only the target queue", async () => {
    const queue = new InMemoryMonitorEventQueue()
    const event = {
      source: monitor.source,
      kind: "comment",
      id: "comment:1",
      at: "2026-08-04T12:01:00.000Z",
      summary: "comment",
      actionable: true,
    }

    const first = await queue.enqueue({ monitor, event })
    const second = await queue.enqueue({ monitor, event })
    assert.equal(second.id, first.id)
    assert.equal((await queue.read(monitor.target)).length, 1)
    assert.equal((await queue.read({ kind: "other", id: "session-2" })).length, 0)

    await queue.acknowledge(monitor.target, [first.id])
    assert.equal((await queue.read(monitor.target)).length, 0)
  })
})
