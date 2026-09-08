import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { adfText } from "./adf-text.ts"
import { appendJiraChangelog } from "./append-jira-changelog.ts"
import { appendJiraComments } from "./append-jira-comments.ts"
import { appendJiraDescription } from "./append-jira-description.ts"
import { emptyJiraCursor } from "./empty-cursor.ts"
import { jiraChangeValue } from "./jira-change-value.ts"
import type { JiraEvent } from "../../types"

process.env.SOURCEFED_JIRA_TERMINAL_STATUS = "Done"

describe("Jira poll event helpers", () => {
  test("primes comments and emits later human comments", () => {
    const cursor = emptyJiraCursor()
    const events: JiraEvent[] = []
    appendJiraComments("PROJ-1", cursor, events, [{ id: "1", body: { content: [{ text: "old" }] } }])
    appendJiraComments("PROJ-1", cursor, events, [{ id: "1", body: { content: [{ text: "old" }] } }, { id: "2", body: { content: [{ text: "new" }] } }])
    assert.equal(events.length, 1)
    assert.equal(events[0].body, "new")
  })

  test("tracks description changes", () => {
    const cursor = emptyJiraCursor()
    const events: JiraEvent[] = []
    appendJiraDescription("PROJ-1", cursor, events, { content: [{ text: "updated" }] })
    appendJiraDescription("PROJ-1", cursor, events, { content: [{ text: "changed" }] })
    assert.deepEqual(events.map((event) => event.kind), ["description"])
    assert.equal(jiraChangeValue({ toString: "Done" }, "to"), "Done")
  })

  test("emits a new status change, not the older label change (Jira returns histories newest-first)", () => {
    const cursor = emptyJiraCursor()
    const events: JiraEvent[] = []
    const labelHistory = { id: "20", created: "2026-09-02T12:29:48.000Z", items: [{ field: "labels", fromString: "", toString: "triage" }] }
    // First poll primes existing history without emitting.
    appendJiraChangelog("PROJ-1", cursor, events, [labelHistory])
    assert.equal(events.length, 0)
    // A status transition happens; Jira prepends it (newest-first).
    appendJiraChangelog("PROJ-1", cursor, events, [
      { id: "31", created: "2026-09-08T06:08:22.000Z", items: [{ field: "status", fromString: "In Progress", toString: "Done" }] },
      labelHistory,
    ])
    assert.equal(events.length, 1)
    assert.equal(events[0].kind, "changelog")
    assert.match(events[0].summary, /status: In Progress → Done/)
  })

  test("walks ADF text nodes", () => {
    assert.equal(adfText({ content: [{ text: "one" }, { content: [{ text: "two" }] }] }), "onetwo")
  })
})
