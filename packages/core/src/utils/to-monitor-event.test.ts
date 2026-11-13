import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { toMonitorEvent } from "./to-monitor-event.ts"

const source = { type: "github-issues", repo: "octo/repo", labels: ["build"] }
const event = { kind: "item.matched", id: "item:octo/repo#48", at: "2026-11-13T10:00:00.000Z", summary: "matched", actionable: true }

describe("toMonitorEvent", () => {
  test("carries the subject a source gives", () => {
    const subject = { type: "github-issue", key: "octo/repo#48", repo: "octo/repo", number: 48 }

    const monitorEvent = toMonitorEvent({ ...event, subject }, source)

    assert.deepEqual(monitorEvent.subject, subject)
    assert.equal(monitorEvent.source, source)
  })

  test("leaves the subject out when a source gives none", () => {
    const monitorEvent = toMonitorEvent(event, source)

    assert.equal("subject" in monitorEvent, false)
  })
})
