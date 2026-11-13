import { assert, assertEqual, daemonEntry, removeDir, tempDir } from "./harness.mjs"

process.env.SOURCEFED_GITHUB_WEBHOOK_SECRET = ""
process.env.SOURCEFED_SLACK_SIGNING_SECRET = ""
const { SourcefedDaemon } = await import(daemonEntry())

const dir = await tempDir("sourcefed-it-schedule-")
let daemon = new SourcefedDaemon({ stateDir: dir })
try {
  await daemon.start()
  const target = { kind: "program", id: "it" }
  const source = { name: "minutely", sourceType: "schedule", cron: "* * * * *", job: "minutely", timezone: "UTC" }
  const created = await daemon.createMonitor(target, source)
  assert(created.ok, `create schedule monitor: ${created.error}`)
  assertEqual(created.monitor.pollIntervalSec, 15, "a schedule checks every 15 seconds")

  const cursorKey = "schedule:minutely:* * * * *:UTC"
  // Two times in the window would be missed, not fired, so stay clear of the next minute.
  if (Date.now() % 60_000 > 55_000) await new Promise((resolve) => setTimeout(resolve, 6_000))
  const minute = Math.floor(Date.now() / 60_000) * 60_000
  await mark(created.monitor.id, cursorKey, new Date(minute - 1_000))

  const received = []
  daemon.subscribe(target, async (events) => { received.push(...events) })
  await daemon.runtime.tick()
  await new Promise((resolve) => setTimeout(resolve, 100))

  assertEqual(received.map((entry) => entry.event.kind).join(","), "schedule.fired", "the minute that just began fires")
  assertEqual(received[0].event.subject.at, new Date(minute).toISOString().replace(".000Z", "+00:00"))

  await daemon.stop()
  daemon = new SourcefedDaemon({ stateDir: dir })
  await mark(created.monitor.id, cursorKey, new Date(minute - 3 * 60_000 - 1_000))
  await daemon.start()
  const after = []
  daemon.subscribe(target, async (events) => { after.push(...events) })
  await daemon.runtime.tick()
  await new Promise((resolve) => setTimeout(resolve, 100))

  const missed = after.filter((entry) => entry.event.kind === "schedule.missed")
  assertEqual(missed.length, 1, "the times passed while stopped become one event")
  assert(missed[0].event.subject.missed >= 4, `missed counts every passed minute (${missed[0].event.subject.missed})`)

  await daemon.stop()
  console.log("provider-schedule: fired and missed through daemon ticks and a restart — ok")
} finally {
  await daemon.stop().catch(() => {})
  await removeDir(dir)
}

async function mark(id, key, at) {
  const record = await daemon.service.get(id)
  await daemon.service.updateCursor(record, key, { checkedAt: at.toISOString() })
  await daemon.service.updateCursor(record, "__lastPolledAt", 0)
}
