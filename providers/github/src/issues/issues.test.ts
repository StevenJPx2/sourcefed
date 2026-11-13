import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { GithubIssuesMonitor } from "./monitor.ts"
import { pollGithubIssues } from "./poll.ts"
import type { GithubIssuesSource } from "./schema.ts"
import { ETAG, REPO, issue, listReply, nextPage, notModified, pullRequest, searchReply, type RecordedIssue } from "./fixtures/recorded-replies.ts"

const source: GithubIssuesSource = { type: "github-issues", repo: REPO, labels: ["atelier:build"] }
const now = () => new Date("2026-11-13T10:00:00.000Z")

type Call = { url: string; headers: Record<string, string> }

function github(...replies: Array<(call: Call) => Response>) {
  const calls: Call[] = []
  const request = async (url: string, headers: Record<string, string>): Promise<Response> => {
    const call = { url, headers }
    calls.push(call)
    const reply = replies.shift()
    if (!reply) throw new Error(`unexpected request ${url}`)
    return reply(call)
  }
  return { calls, request }
}

const list = (items: RecordedIssue[], options?: { etag?: string; next?: string }) => () => listReply(items, options)

describe("github-issues", () => {
  test("the first poll primes silently and keeps the list's ETag", async () => {
    const { request, calls } = github(list([issue(48), issue(49)], { etag: ETAG }))

    const result = await pollGithubIssues(source, undefined, request, now)

    assert.deepEqual(result.events, [])
    assert.deepEqual(result.cursor, { primed: true, keys: [`${REPO}#48`, `${REPO}#49`], overLimit: false, etag: ETAG })
    assert.match(calls[0].url, /\/repos\/example-org\/example-repo\/issues\?state=open&labels=atelier%3Abuild&per_page=100$/)
  })

  test("a label added sends item.matched with the issue's subject", async () => {
    const primed = { primed: true, keys: [`${REPO}#48`], overLimit: false, etag: ETAG }
    const { request, calls } = github(list([issue(48), issue(50, "Add schedules")], { etag: 'W/"next"' }))

    const result = await pollGithubIssues(source, primed, request, now)

    assert.equal(calls[0].headers["if-none-match"], ETAG)
    assert.deepEqual(result.events, [{
      kind: "item.matched",
      id: `item.matched:${REPO}#50:2026-11-13T10:00:00.000Z`,
      at: "2026-11-13T10:00:00.000Z",
      summary: `GitHub issue ${REPO}#50 matches label atelier:build: Add schedules`,
      body: `https://github.com/${REPO}/issues/50`,
      actionable: true,
      subject: {
        type: "github-issue",
        key: `${REPO}#50`,
        repo: REPO,
        number: 50,
        url: `https://github.com/${REPO}/issues/50`,
        title: "Add schedules",
      },
    }])
  })

  test("a label removed or an issue closed sends item.unmatched", async () => {
    const primed = { primed: true, keys: [`${REPO}#48`, `${REPO}#49`], overLimit: false }
    const { request } = github(list([issue(49)]))

    const result = await pollGithubIssues(source, primed, request, now)

    assert.deepEqual(result.events.map((event) => [event.kind, event.subject?.key, event.actionable]), [
      ["item.unmatched", `${REPO}#48`, false],
    ])
    assert.equal(result.events[0].subject?.number, 48)
  })

  test("a 304 sends nothing and keeps the cursor", async () => {
    const primed = { primed: true, keys: [`${REPO}#48`], overLimit: false, etag: ETAG }
    const { request } = github(() => notModified())

    const result = await pollGithubIssues(source, primed, request, now)

    assert.deepEqual(result.events, [])
    assert.equal(result.cursor, primed)
  })

  test("includeExisting sends item.matched for every current issue on the first poll", async () => {
    const { request } = github(list([issue(48), issue(49)]))

    const result = await pollGithubIssues({ ...source, includeExisting: true }, undefined, request, now)

    assert.deepEqual(result.events.map((event) => event.subject?.number), [48, 49])
  })

  test("follows the Link header across pages, skips pull requests, and keeps no ETag", async () => {
    const { request, calls } = github(
      list([issue(48), pullRequest(47)], { etag: ETAG, next: nextPage(2) }),
      list([issue(12)], { etag: 'W/"page-2"' }),
      list([issue(48), issue(12)]),
    )

    const first = await pollGithubIssues(source, undefined, request, now)
    await pollGithubIssues(source, first.cursor, request, now)

    assert.equal(calls[1].url, nextPage(2))
    assert.deepEqual(first.cursor, { primed: true, keys: [`${REPO}#48`, `${REPO}#12`], overLimit: false })
    assert.equal(calls[2].headers["if-none-match"], undefined)
  })

  test("past 1,000 issues, reports one error and reports nothing unmatched", async () => {
    const primed = { primed: true, keys: [`${REPO}#1`], overLimit: false }
    const pages = Array.from({ length: 11 }, (_, page) => {
      const items = Array.from({ length: 100 }, (_, index) => issue(page * 100 + index + 1))
      return list(items, { next: nextPage(page + 2) })
    })
    const { request, calls } = github(...pages, ...pages)

    const first = await pollGithubIssues(source, primed, request, now)
    const second = await pollGithubIssues(source, first.cursor, request, now)

    assert.equal(calls.length, 22)
    assert.deepEqual(first.events.map((event) => event.kind), ["error"])
    assert.match(first.events[0].summary, /More than 1,000 GitHub issues/)
    assert.deepEqual(first.cursor, { primed: true, keys: [`${REPO}#1`], overLimit: true })
    assert.deepEqual(second.events, [])
  })

  test("a failed reply throws, so the poll keeps its cursor", async () => {
    const { request } = github(() => new Response('{"message":"Server Error"}', { status: 502 }))

    await assert.rejects(pollGithubIssues(source, undefined, request, now), /GitHub 502 for \/repos\/example-org\/example-repo\/issues/)
  })

  test("a query searches, and refuses incomplete results", async () => {
    const withQuery = { ...source, assignee: "octocat", query: "milestone:v2" }
    const { request, calls } = github(() => searchReply([issue(48)]), () => searchReply([], 0, true))

    const result = await pollGithubIssues({ ...withQuery, includeExisting: true }, undefined, request, now)

    const query = new URL(calls[0].url).searchParams.get("q")
    assert.equal(query, `repo:${REPO} is:issue is:open label:"atelier:build" assignee:octocat milestone:v2`)
    assert.deepEqual(result.events.map((event) => event.subject?.number), [48])
    await assert.rejects(pollGithubIssues(withQuery, result.cursor, request, now), /incomplete results/)
  })

  test("a search past 1,000 results reports the limit", async () => {
    const { request } = github(() => searchReply([issue(1)], 1_001))

    const result = await pollGithubIssues({ ...source, query: "is:public" }, undefined, request, now)

    assert.deepEqual(result.events.map((event) => event.kind), ["error"])
  })
})

describe("GithubIssuesMonitor", () => {
  const monitor = new GithubIssuesMonitor()

  test("builds a source with sorted, distinct labels", () => {
    const built = monitor.build({ repo: REPO, labels: ["b", "a", "b", " "], includeExisting: true })

    assert.deepEqual(built, { type: "github-issues", repo: REPO, labels: ["a", "b"], includeExisting: true })
  })

  test("refuses a source without a repository or labels", () => {
    assert.deepEqual(monitor.build({ labels: ["a"] }), { error: "repo must be owner/name for a github-issues monitor" })
    assert.deepEqual(monitor.build({ repo: REPO, labels: [] }), { error: "labels is required for a github-issues monitor" })
  })

  test("wakes on the repository's issues webhooks only", () => {
    const payload = { action: "labeled", repository: { full_name: "Example-Org/Example-Repo" } }

    assert.equal(monitor.wake.matches(source, payload, "issues"), true)
    assert.equal(monitor.wake.matches(source, payload, "pull_request"), false)
    assert.equal(monitor.wake.matches(source, { repository: { full_name: "other/repo" } }, "issues"), false)
  })
})
