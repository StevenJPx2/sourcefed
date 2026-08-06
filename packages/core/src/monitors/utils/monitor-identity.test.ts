import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { dedupeActiveMonitors } from "@sourcefed/core"
import { eventToText } from "@sourcefed/core"

describe("Monitor identity", () => {
  test("keeps one active monitor per session and source", () => {
    const first = {
      id: "m-first",
      name: "ADEPT-43742",
      source: { type: "jira" as const, issueKey: "ADEPT-43742" },
      delivery: "poll" as const,
      target: { kind: "test-session", id: "session-1" },
      pollIntervalSec: 60,
      enabled: true,
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
      cursors: {},
    }
    const duplicate = { ...first, id: "m-duplicate", name: "same issue" }
    const otherSession = { ...first, id: "m-other-session", target: { kind: "test-session", id: "session-2" } }
    const stopped = { ...first, id: "m-stopped", enabled: false }

    assert.deepEqual(dedupeActiveMonitors([first, duplicate, otherSession, stopped]).map((monitor) => monitor.id), [
      "m-first",
      "m-other-session",
      "m-stopped",
    ])
  })
})

describe("shared formatting", () => {
  test("formats routed events", () => {
    assert.ok(eventToText({
      source: { type: "jira", issueKey: "PROJ-1" },
      kind: "comment",
      at: "2026-08-04T12:00:00.000Z",
      summary: "A comment",
      body: "Details",
      actionable: true,
    }).includes("Details"))
  })
})
