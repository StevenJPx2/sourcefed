import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, test } from "node:test"
import { orderedByKey } from "./api.ts"
import { JiraQueryMonitor } from "./monitor.ts"
import { pollJiraQuery } from "./poll.ts"
import type { JiraQuerySource } from "./schema.ts"
import { BASE, issue, page, unbounded } from "./fixtures/recorded-replies.ts"

const source: JiraQuerySource = { type: "jira-query", jql: "project = PROJ AND labels = agent" }
const now = () => new Date("2026-11-13T10:00:00.000Z")
const previousBase = process.env.SOURCEFED_JIRA_BASE_URL

beforeEach(() => {
  process.env.SOURCEFED_JIRA_BASE_URL = BASE
})

afterEach(() => {
  if (previousBase === undefined) delete process.env.SOURCEFED_JIRA_BASE_URL
  else process.env.SOURCEFED_JIRA_BASE_URL = previousBase
})

function jira(...replies: Array<() => Response>) {
  const paths: string[] = []
  const request = async (path: string): Promise<Response> => {
    paths.push(path)
    const reply = replies.shift()
    if (!reply) throw new Error(`unexpected request ${path}`)
    return reply()
  }
  return { paths, request }
}

describe("jira-query", () => {
  test("the first poll primes silently, searching by key order", async () => {
    const { request, paths } = jira(() => page([issue(7), issue(8)]))

    const result = await pollJiraQuery(source, undefined, request, now)

    assert.deepEqual(result.events, [])
    assert.deepEqual(result.cursor, { primed: true, keys: ["PROJ-7", "PROJ-8"], overLimit: false })
    const query = new URLSearchParams(paths[0].split("?")[1])
    assert.equal(query.get("jql"), "project = PROJ AND labels = agent ORDER BY key ASC")
    assert.equal(query.get("fields"), "summary")
  })

  test("an issue that starts matching sends item.matched with its subject", async () => {
    const primed = { primed: true, keys: ["PROJ-7"], overLimit: false }
    const { request } = jira(() => page([issue(7), issue(9, "Add schedules")]))

    const result = await pollJiraQuery(source, primed, request, now)

    assert.deepEqual(result.events, [{
      kind: "item.matched",
      id: "item.matched:PROJ-9:2026-11-13T10:00:00.000Z",
      at: "2026-11-13T10:00:00.000Z",
      summary: 'Jira PROJ-9 matches "project = PROJ AND labels = agent": Add schedules',
      body: `${BASE}/browse/PROJ-9`,
      actionable: true,
      subject: { type: "jira-issue", key: "PROJ-9", url: `${BASE}/browse/PROJ-9`, title: "Add schedules" },
    }])
  })

  test("an issue that stops matching sends item.unmatched", async () => {
    const primed = { primed: true, keys: ["PROJ-7", "PROJ-8"], overLimit: false }
    const { request } = jira(() => page([issue(8)]))

    const result = await pollJiraQuery(source, primed, request, now)

    assert.deepEqual(result.events.map((event) => [event.kind, event.subject?.key, event.actionable]), [
      ["item.unmatched", "PROJ-7", false],
    ])
  })

  test("includeExisting sends item.matched for every current issue on the first poll", async () => {
    const { request } = jira(() => page([issue(7), issue(8)]))

    const result = await pollJiraQuery({ ...source, includeExisting: true }, undefined, request, now)

    assert.deepEqual(result.events.map((event) => event.subject?.key), ["PROJ-7", "PROJ-8"])
  })

  test("follows nextPageToken until the last page", async () => {
    const { request, paths } = jira(() => page([issue(7)], "CkBpc3N1ZUtl-2"), () => page([issue(12)]))

    const result = await pollJiraQuery(source, undefined, request, now)

    assert.equal(new URLSearchParams(paths[1].split("?")[1]).get("nextPageToken"), "CkBpc3N1ZUtl-2")
    assert.deepEqual((result.cursor as { keys: string[] }).keys, ["PROJ-7", "PROJ-12"])
  })

  test("past 1,000 issues, reports one error and reports nothing unmatched", async () => {
    const primed = { primed: true, keys: ["PROJ-1"], overLimit: false }
    const pages = Array.from({ length: 11 }, (_, index) => () => {
      const issues = Array.from({ length: 100 }, (_, offset) => issue(index * 100 + offset + 1))
      return page(issues, `token-${index + 1}`)
    })
    const { request, paths } = jira(...pages, ...pages)

    const first = await pollJiraQuery(source, primed, request, now)
    const second = await pollJiraQuery(source, first.cursor, request, now)

    assert.equal(paths.length, 22)
    assert.deepEqual(first.events.map((event) => event.kind), ["error"])
    assert.match(first.events[0].summary, /More than 1,000 Jira issues/)
    assert.deepEqual(first.cursor, { primed: true, keys: ["PROJ-1"], overLimit: true })
    assert.deepEqual(second.events, [])
  })

  test("a refused query throws with Jira's message, so the poll keeps its cursor", async () => {
    const { request } = jira(unbounded)

    await assert.rejects(pollJiraQuery(source, undefined, request, now), /Jira search answered 400: Unbounded JQL queries/)
  })

  test("keeps a query's own ordering", () => {
    assert.equal(orderedByKey("project = PROJ order by created DESC"), "project = PROJ order by created DESC")
  })
})

describe("JiraQueryMonitor", () => {
  const monitor = new JiraQueryMonitor()

  test("builds a source from trimmed JQL", () => {
    assert.deepEqual(monitor.build({ jql: "  project = PROJ  ", includeExisting: true }), {
      type: "jira-query",
      jql: "project = PROJ",
      includeExisting: true,
    })
  })

  test("refuses a source without JQL", () => {
    assert.deepEqual(monitor.build({ jql: " " }), { error: "jql is required for a jira-query monitor" })
  })
})
