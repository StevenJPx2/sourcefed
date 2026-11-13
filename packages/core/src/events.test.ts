import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { InMemoryMonitorEventQueue, TARGET_QUEUE_LIMIT } from "./events.ts"

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

  test("past its limit, a target drops its oldest events and gets one overflow per monitor", async () => {
    const queue = new InMemoryMonitorEventQueue(3)
    const other = { ...monitor, id: "m-other" }
    const event = (id: string) => ({ source: monitor.source, kind: "comment", id, at: "2026-08-04T12:01:00.000Z", summary: id, actionable: true })

    await queue.enqueue({ monitor: other, event: event("b1") })
    for (const id of ["a1", "a2", "a3", "a4"]) await queue.enqueue({ monitor, event: event(id) })

    const held = await queue.read(monitor.target)
    assert.deepEqual(held.map((queued) => queued.id), ["m-test:a2", "m-test:a3", "m-other:overflow", "m-test:a4", "m-test:overflow"])
    assert.deepEqual(held[2].event.subject, { type: "monitor", key: "m-other", dropped: 1 })
    assert.equal(held[2].event.kind, "overflow")

    await queue.enqueue({ monitor, event: event("a5") })
    await queue.enqueue({ monitor, event: event("a6") })

    const later = await queue.read(monitor.target)
    const overflows = later.filter((queued) => queued.event.kind === "overflow")
    assert.deepEqual(later.filter((queued) => queued.event.kind !== "overflow").map((queued) => queued.event.id), ["a4", "a5", "a6"])
    assert.deepEqual(overflows.map((queued) => [queued.monitorID, queued.event.subject?.dropped]), [["m-other", 1], ["m-test", 3]])
    assert.match(overflows[1].event.summary, /dropped 3 unacknowledged events of monitor m-test; re-list its source/)

    await queue.acknowledge(monitor.target, ["m-test:overflow"])
    await queue.enqueue({ monitor, event: event("a7") })

    const fresh = (await queue.read(monitor.target)).find((queued) => queued.id === "m-test:overflow")
    assert.equal(fresh?.event.subject?.dropped, 1)
  })

  test("holds 1,000 events for a target by default", () => {
    assert.equal(TARGET_QUEUE_LIMIT, 1_000)
  })
})
