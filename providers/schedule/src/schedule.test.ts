import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { MISSED_COUNT_LIMIT, firingsBetween, zonedIso } from "./firings.ts"
import { ScheduleMonitor } from "./monitor.ts"
import { pollSchedule } from "./poll.ts"
import type { ScheduleSource } from "./schema.ts"

const nightly: ScheduleSource = { type: "schedule", cron: "0 2 * * *", job: "nightly-audit", timezone: "Asia/Kolkata" }
const checked = (iso: string) => ({ checkedAt: new Date(iso).toISOString() })

describe("schedule", () => {
  test("the first poll only marks the time", () => {
    const now = new Date("2026-11-14T02:00:05+05:30")

    const result = pollSchedule(nightly, undefined, now)

    assert.deepEqual(result, { cursor: { checkedAt: now.toISOString() }, events: [] })
  })

  test("a time found promptly sends schedule.fired", () => {
    const result = pollSchedule(nightly, checked("2026-11-14T01:59:50+05:30"), new Date("2026-11-14T02:00:05+05:30"))

    assert.deepEqual(result.events, [{
      kind: "schedule.fired",
      id: "schedule.fired:nightly-audit:2026-11-14T02:00:00+05:30",
      at: "2026-11-14T02:00:00+05:30",
      summary: "Schedule nightly-audit fired for 2026-11-14T02:00:00+05:30",
      actionable: true,
      subject: {
        type: "schedule",
        key: "nightly-audit",
        job: "nightly-audit",
        at: "2026-11-14T02:00:00+05:30",
        cron: "0 2 * * *",
        timezone: "Asia/Kolkata",
      },
    }])
  })

  test("three missed times become one schedule.missed with the latest", () => {
    const result = pollSchedule(nightly, checked("2026-11-14T01:00:00+05:30"), new Date("2026-11-16T09:00:00+05:30"))

    assert.equal(result.events.length, 1)
    assert.equal(result.events[0].kind, "schedule.missed")
    assert.equal(result.events[0].at, "2026-11-16T02:00:00+05:30")
    assert.equal(result.events[0].subject?.missed, 3)
    assert.equal(result.events[0].summary, "Schedule nightly-audit missed 3 times; the latest was 2026-11-16T02:00:00+05:30")
  })

  test("one time found late is missed, not fired", () => {
    const result = pollSchedule(nightly, checked("2026-11-14T01:59:00+05:30"), new Date("2026-11-14T05:00:00+05:30"))

    assert.deepEqual(result.events.map((event) => [event.kind, event.subject?.missed]), [["schedule.missed", 1]])
  })

  test("nothing due sends nothing and moves the mark", () => {
    const now = new Date("2026-11-14T03:00:00+05:30")

    const result = pollSchedule(nightly, checked("2026-11-14T02:30:00+05:30"), now)

    assert.deepEqual(result, { cursor: { checkedAt: now.toISOString() }, events: [] })
  })

  test("in spring, a time the clock skips fires once, at the new hour", () => {
    const day = firingsBetween("30 2 * * *", "America/New_York", new Date("2027-03-13T12:00:00Z"), new Date("2027-03-14T12:00:00Z"))

    assert.equal(day?.count, 1)
    assert.equal(zonedIso(day!.latest, "America/New_York"), "2027-03-14T03:00:00-04:00")
  })

  test("in autumn, a time the clock repeats fires once", () => {
    const source = { ...nightly, cron: "30 1 * * *", timezone: "America/New_York" }

    const day = firingsBetween(source.cron, source.timezone, new Date("2026-10-31T12:00:00Z"), new Date("2026-11-01T12:00:00Z"))
    const prompt = pollSchedule(source, checked("2026-11-01T05:29:50Z"), new Date("2026-11-01T05:30:05Z"))
    const repeat = pollSchedule(source, prompt.cursor, new Date("2026-11-01T06:30:05Z"))

    assert.equal(day?.count, 1)
    assert.deepEqual(prompt.events.map((event) => event.at), ["2026-11-01T01:30:00-04:00"])
    assert.deepEqual(repeat.events, [])
  })

  test("counts missed times up to the limit and still reports the latest", () => {
    const everySecond = { ...nightly, cron: "* * * * * *", timezone: "UTC" }

    const result = pollSchedule(everySecond, checked("2026-11-14T00:00:00Z"), new Date("2026-11-14T01:00:00.500Z"))

    assert.equal(result.events[0].subject?.missed, MISSED_COUNT_LIMIT)
    assert.equal(result.events[0].at, "2026-11-14T01:00:00+00:00")
  })
})

describe("ScheduleMonitor", () => {
  const monitor = new ScheduleMonitor()

  test("builds a source and checks every 15 seconds by default", () => {
    assert.deepEqual(monitor.build({ cron: " 0 2 * * * ", job: "nightly-audit", timezone: "Asia/Kolkata" }), nightly)
    assert.equal(monitor.defaultPollIntervalSec, 15)
  })

  test("refuses an invalid cron, an unknown zone, or a missing job", () => {
    assert.match(String((monitor.build({ cron: "61 * * * *", job: "x" }) as { error: string }).error), /invalid schedule: .*minute/)
    assert.match(String((monitor.build({ cron: "0 2 * * *", job: "x", timezone: "Mars/Olympus" }) as { error: string }).error), /invalid schedule/)
    assert.deepEqual(monitor.build({ cron: "0 2 * * *" }), { error: "job is required for a schedule monitor" })
  })
})
