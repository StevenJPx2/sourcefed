import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { appendGithubCiEvent } from "../github/src/poll/utils/append-github-ci-event.ts"
import { appendGithubConflictEvent } from "../github/src/poll/utils/append-github-conflict-event.ts"
import { appendGithubReviews } from "../github/src/poll/utils/append-github-reviews.ts"
import { appendGithubStateEvent } from "../github/src/poll/utils/append-github-state-event.ts"
import { emptyGithubCursor } from "../github/src/poll/utils/empty-cursor.ts"
import { parseGithubData } from "../github/src/poll/utils/parse-github-data.ts"
import { GithubCursorSchema } from "../github/src/schema.ts"
import { updateGithubCursor } from "../github/src/webhook/utils/update-github-cursor.ts"
import type { GithubEvent } from "../github/src/types"
import { dedupeActiveMonitors } from "@sourcefed/core"
import { adfText } from "../jira/src/poll/utils/adf-text.ts"
import { appendJiraChangelog } from "../jira/src/poll/utils/append-jira-changelog.ts"
import { appendJiraComments } from "../jira/src/poll/utils/append-jira-comments.ts"
import { appendJiraDescription } from "../jira/src/poll/utils/append-jira-description.ts"
import { emptyJiraCursor } from "../jira/src/poll/utils/empty-cursor.ts"
import type { JiraEvent } from "../jira/src/types"
import { jiraChangeValue } from "../jira/src/poll/utils/jira-change-value.ts"
import { eventToText } from "@sourcefed/core"

process.env.SOURCEFED_JIRA_TERMINAL_STATUS = "Done"

describe("GitHub poll event helpers", () => {
  test("accepts cursors written before newer fields existed", () => {
    const parsed = v.safeParse(GithubCursorSchema, {
      reviewIds: [],
      commentIds: [],
      ciState: "success",
      mergeable: "MERGEABLE",
      prState: "OPEN",
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.output.historyPrimed).toBe(false)
      expect(parsed.output.conversationCommentsPrimed).toBe(false)
      expect(parsed.output.ciFailureState).toBe("")
    }
  })

  test("parses valid and invalid CLI JSON", () => {
    expect(parseGithubData('{"state":"OPEN"}')).toEqual({ state: "OPEN" })
    expect(parseGithubData("not json")).toBeUndefined()
  })

  test("adds reviews only after history is primed", () => {
    const cursor = emptyGithubCursor()
    const events: GithubEvent[] = []
    appendGithubReviews("org/repo", 12, cursor, events, [{ id: 1, state: "COMMENTED", body: "Please fix" }], false)
    expect(events).toHaveLength(0)
    appendGithubReviews("org/repo", 12, cursor, events, [{ id: 2, state: "CHANGES_REQUESTED", body: "Fix" }], true)
    expect(events).toHaveLength(1)
    expect(events[0].actionable).toBe(true)
  })

  test("tracks CI, conflict, and merged state transitions", () => {
    const cursor = emptyGithubCursor()
    const events: GithubEvent[] = []
    appendGithubCiEvent("org/repo", 12, cursor, events, [{ name: "Lint", conclusion: "success" }])
    appendGithubConflictEvent("org/repo", 12, cursor, events, "MERGEABLE")
    appendGithubConflictEvent("org/repo", 12, cursor, events, "CONFLICTING")
    appendGithubStateEvent("org/repo", 12, cursor, events, "OPEN")
    appendGithubStateEvent("org/repo", 12, cursor, events, "MERGED")
    expect(events.map((event) => event.kind)).toEqual(["conflict", "merged"])
    expect(events.at(-1)?.terminal).toBe(true)
  })

  test("reconciles webhook review and comment IDs into the poll cursor", () => {
    const cursor = updateGithubCursor({
      source: { type: "github", repo: "org/repo", prNumber: 12 },
      kind: "comment",
      id: "c:42",
      at: "2026-08-04T12:00:00.000Z",
      summary: "comment",
      actionable: true,
    }, { reviewIds: [], commentIds: [], ciState: "", mergeable: "", prState: "" })
    expect(cursor.commentIds).toEqual(["c:42"])
    expect(cursor.historyPrimed).toBe(false)
  })
})

describe("Jira poll event helpers", () => {
  test("primes comments and emits later human comments", () => {
    const cursor = emptyJiraCursor()
    const events: JiraEvent[] = []
    appendJiraComments("PROJ-1", cursor, events, [{ id: "1", body: { content: [{ text: "old" }] } }])
    appendJiraComments("PROJ-1", cursor, events, [{ id: "1", body: { content: [{ text: "old" }] } }, { id: "2", body: { content: [{ text: "new" }] } }])
    expect(events).toHaveLength(1)
    expect(events[0].body).toBe("new")
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
    expect(events.map((event) => event.kind)).toEqual(["description", "changelog"])
    expect(jiraChangeValue({ toString: "Done" }, "to")).toBe("Done")
  })

  test("walks ADF text nodes", () => {
    expect(adfText({ content: [{ text: "one" }, { content: [{ text: "two" }] }] })).toBe("onetwo")
  })
})

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

    expect(dedupeActiveMonitors([first, duplicate, otherSession, stopped]).map((monitor) => monitor.id)).toEqual([
      "m-first",
      "m-other-session",
      "m-stopped",
    ])
  })
})

describe("shared formatting", () => {
  test("formats timestamps and routed events", () => {
    expect(eventToText({
       source: { type: "jira", issueKey: "PROJ-1" },
      kind: "comment",
      at: "2026-08-04T12:00:00.000Z",
      summary: "A comment",
      body: "Details",
      actionable: true,
    })).toContain("Details")
  })
})
