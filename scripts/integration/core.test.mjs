import { assert, assertEqual, removeDir, tempDir } from "./harness.mjs"
import { JsonMonitorEventQueue, JsonMonitorStore } from "@sourcefed/core"

const dir = await tempDir("sourcefed-it-core-")
try {
  const store = new JsonMonitorStore({ stateDir: dir })
  const monitor = {
    id: "m-it-1",
    name: "PROJ-1",
    source: { type: "jira", issueKey: "PROJ-1" },
    delivery: "poll",
    target: { kind: "it", id: "consumer-1" },
    pollIntervalSec: 60,
    enabled: true,
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
    cursors: {},
  }

  await store.save({ monitors: [monitor] })
  const reloaded = await new JsonMonitorStore({ stateDir: dir }).load()
  assertEqual(reloaded.monitors.length, 1, "store roundtrip")
  assertEqual(reloaded.monitors[0].id, "m-it-1")

  const malformed = await tempDir("sourcefed-it-core-bad-")
  const badStore = new JsonMonitorStore({ stateDir: malformed })
  const { writeFile } = await import("node:fs/promises")
  await writeFile(`${malformed}/monitors.json`, "{ not json")
  let threw = false
  try {
    await badStore.load()
  } catch {
    threw = true
  }
  assert(threw, "malformed state must reject")
  await removeDir(malformed)

  const release = await store.acquireExclusive()
  let secondRejected = false
  try {
    await new JsonMonitorStore({ stateDir: dir }).acquireExclusive()
  } catch {
    secondRejected = true
  }
  assert(secondRejected, "second daemon lock must reject")
  await release()
  await new JsonMonitorStore({ stateDir: dir }).acquireExclusive().then((r) => r())

  const queue = new JsonMonitorEventQueue(dir)
  const queued = await queue.enqueue({ monitor, event: {
    source: monitor.source,
    kind: "comment",
    id: "comment:1",
    at: "2026-08-05T00:01:00.000Z",
    summary: "comment one",
    actionable: true,
  } })
  const duplicate = await queue.enqueue({ monitor, event: {
    source: monitor.source,
    kind: "comment",
    id: "comment:1",
    at: "2026-08-05T00:01:00.000Z",
    summary: "comment one",
    actionable: true,
  } })
  assertEqual(duplicate.id, queued.id, "queue dedupe")
  assertEqual((await queue.read(monitor.target)).length, 1)
  await queue.acknowledge(monitor.target, [queued.id])
  assertEqual((await queue.read(monitor.target)).length, 0)

  console.log("core: store roundtrip, malformed rejection, exclusive lock, queue dedupe/ack — ok")
} finally {
  await removeDir(dir)
}
