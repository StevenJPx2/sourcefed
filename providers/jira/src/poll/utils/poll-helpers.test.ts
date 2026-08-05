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

  test("tracks description and status history", () => {
    const cursor = emptyJiraCursor()
    const events: JiraEvent[] = []
    appendJiraDescription("PROJ-1", cursor, events, { content: [{ text: "updated" }] })
    appendJiraDescription("PROJ-1", cursor, events, { content: [{ text: "changed" }] })
    cursor.changelogCount = 1
    appendJiraChangelog("PROJ-1", cursor, events, [{
      items: [],
    }, {
      created: "2026-08-04T12:00:00.000Z",
      items: [{ field: "status", fromString: "In Progress", toString: "Done" }],
    }])
    assert.deepEqual(events.map((event) => event.kind), ["description", "changelog"])
    assert.equal(jiraChangeValue({ toString: "Done" }, "to"), "Done")
  })

  test("walks ADF text nodes", () => {
    assert.equal(adfText({ content: [{ text: "one" }, { content: [{ text: "two" }] }] }), "onetwo")
  })
})
