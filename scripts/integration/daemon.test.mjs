import { assert, assertEqual, removeDir, tempDir } from "./harness.mjs"
import { SourcefedDaemon } from "@sourcefed/daemon"

const dir = await tempDir("sourcefed-it-daemon-")
const daemon = new SourcefedDaemon({ stateDir: dir })
try {
  await daemon.start()

  const target = { kind: "it", id: "consumer-1" }
  const created = await daemon.createMonitor(target, { name: "PROJ-1", sourceType: "jira", issueKey: "PROJ-1" })
  assert(created.ok, "create monitor")
  const monitorId = created.ok && created.monitor ? created.monitor.id : ""

  const listed = await daemon.listMonitors(target)
  assertEqual(listed.ok && listed.monitors ? listed.monitors.length : 0, 1, "list monitors")

  const status = await daemon.getMonitor(target, monitorId)
  assert(status.ok && status.monitor && status.monitor.enabled, "status enabled")

  const received = []
  const unsubscribe = daemon.subscribe(target, async (events) => { received.push(...events) })
  const record = await daemon.service.get(monitorId)
  assert(record, "record found")
  await daemon.runtime.context.sink.deliver({
    monitor: record,
    event: {
      source: record.source,
      kind: "comment",
      id: "comment:1",
      at: "2026-08-05T00:01:00.000Z",
      summary: "daemon delivered comment",
      body: "hello",
      actionable: true,
    },
  })
  await new Promise((resolve) => setTimeout(resolve, 200))
  assertEqual(received.length, 1, "subscriber received event")
  assertEqual(received[0].event.summary, "daemon delivered comment")

  await daemon.acknowledgeEvents(target, received.map((event) => event.id))
  assertEqual((await daemon.readEvents(target)).length, 0, "ack drained queue")
  unsubscribe()

  const stopped = await daemon.stopMonitor(target, monitorId)
  assert(stopped.ok && stopped.monitor && !stopped.monitor.enabled, "stop monitor")

  const foreign = await daemon.stopMonitor({ kind: "other", id: "session-2" }, monitorId)
  assert(!foreign.ok, "foreign target cannot stop")

  await daemon.stop()

  const second = new SourcefedDaemon({ stateDir: dir })
  await second.start()
  await second.stop()
  console.log("daemon: lifecycle, event delivery, ack, target scoping, lock release — ok")
} finally {
  await daemon.stop().catch(() => {})
  await removeDir(dir)
}
