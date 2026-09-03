import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { InMemoryMonitorEventQueue, InMemoryMonitorStore, type MonitorTarget, type QueuedMonitorEvent } from "@sourcefed/core"
import { SourcefedDaemon } from "./daemon.ts"

const target: MonitorTarget = { kind: "test", id: "session-1" }

function createDaemon(): SourcefedDaemon {
  return new SourcefedDaemon({
    store: new InMemoryMonitorStore(),
    eventQueue: new InMemoryMonitorEventQueue(),
  })
}

describe("SourcefedDaemon", () => {
  test("creates, lists, and stops monitors owned by a target", async () => {
    const daemon = createDaemon()
    const created = await daemon.createMonitor(target, { name: "ADEPT-43742", sourceType: "jira", issueKey: "ADEPT-43742" })
    assert.equal(created.ok, true)
    if (!created.ok) return
    assert.equal(created.created, true)
    assert.deepEqual(created.monitor?.source, { type: "jira", issueKey: "ADEPT-43742" })

    const listed = await daemon.listMonitors(target)
    assert.equal(listed.ok ? listed.monitors?.length : undefined, 1)

    const foreign = await daemon.getMonitor({ kind: "other", id: "session-2" }, created.monitor!.id)
    assert.deepEqual(foreign, { ok: false, error: `monitor ${created.monitor!.id} was not found for this target` })

    const stopped = await daemon.stopMonitor(target, created.monitor!.id)
    assert.equal(stopped.ok && stopped.monitor?.enabled, false)
    await daemon.stop()
  })

  test("rejects unknown source types", async () => {
    const daemon = createDaemon()
    const result = await daemon.createMonitor(target, { name: "nope", sourceType: "telepathy" })
    assert.deepEqual(result, { ok: false, error: "unknown source type telepathy; expected jira|github|slack" })
    await daemon.stop()
  })

  test("delivers queued events to subscribers until acknowledged", async () => {
    const daemon = createDaemon()
    const created = await daemon.createMonitor(target, { name: "ADEPT-43742", sourceType: "jira", issueKey: "ADEPT-43742" })
    if (!created.ok || !created.monitor) throw new Error("monitor creation failed")
    const monitor = created.monitor

    const received: QueuedMonitorEvent[] = []
    const unsubscribe = daemon.subscribe(target, (events) => received.push(...events))
    const record = await daemon.service.get(monitor.id)
    if (!record) throw new Error("monitor record not found")

    await daemon.runtime.context.sink.deliver({
      monitor: record,
      event: {
        source: monitor.source,
        kind: "comment",
        id: "comment:1",
        at: "2026-08-04T12:00:00.000Z",
        summary: "Jira ADEPT-43742 comment",
        actionable: true,
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 10))
    assert.equal(received.length, 1)
    assert.equal(received[0].event.summary, "Jira ADEPT-43742 comment")

    const acked = await daemon.acknowledgeEvents(target, [received[0].id])
    assert.equal(acked.ok, true)
    assert.equal((await daemon.readEvents(target)).length, 0)

    unsubscribe()
    await daemon.stop()
  })

  test("does not redeliver in-flight events before acknowledgement", async () => {
    const daemon = createDaemon()
    const created = await daemon.createMonitor(target, { name: "ADEPT-43742", sourceType: "jira", issueKey: "ADEPT-43742" })
    if (!created.ok || !created.monitor) throw new Error("monitor creation failed")
    const record = await daemon.service.get(created.monitor.id)
    if (!record) throw new Error("monitor record not found")

    const received: string[] = []
    daemon.subscribe(target, (events) => received.push(...events.map((event) => event.id)))

    for (const id of ["comment:1", "comment:2"]) {
      await daemon.runtime.context.sink.deliver({
        monitor: record,
        event: {
          source: record.source,
          kind: "comment",
          id,
          at: "2026-08-04T12:00:00.000Z",
          summary: `comment ${id}`,
          actionable: true,
        },
      })
    }
    await new Promise((resolve) => setTimeout(resolve, 20))

    assert.deepEqual(received, [`${record.id}:comment:1`, `${record.id}:comment:2`])
    await daemon.stop()
  })

  test("delivers an event once when three clients subscribe to the same target", async () => {
    const daemon = createDaemon()
    const created = await daemon.createMonitor(target, { name: "ADEPT-43742", sourceType: "jira", issueKey: "ADEPT-43742" })
    if (!created.ok || !created.monitor) throw new Error("monitor creation failed")
    const record = await daemon.service.get(created.monitor.id)
    if (!record) throw new Error("monitor record not found")

    const received = [0, 0, 0]
    received.forEach((_, index) => daemon.subscribe(target, (events) => { received[index] += events.length }))

    await daemon.runtime.context.sink.deliver({
      monitor: record,
      event: {
        source: record.source,
        kind: "comment",
        id: "comment:1",
        at: "2026-08-04T12:00:00.000Z",
        summary: "Jira ADEPT-43742 comment",
        actionable: true,
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 10))

    assert.equal(received.reduce((total, count) => total + count, 0), 1)
    await daemon.stop()
  })
})
