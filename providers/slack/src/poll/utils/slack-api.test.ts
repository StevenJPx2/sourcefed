import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { fetchSlackThread, resetSlackApi } from "./slack-api.ts"
import { SlackRateLimiter } from "./slack-limiter.ts"

const realFetch = globalThis.fetch
const realToken = process.env.SOURCEFED_SLACK_TOKEN
let calls: string[] = []

function stubSlack(replies: Record<string, unknown>): void {
  globalThis.fetch = (async (url: string) => {
    const method = String(url).split("/").pop()!
    calls.push(method)
    return new Response(JSON.stringify(replies[method] ?? { ok: false, error: "unknown_method" }))
  }) as typeof fetch
}

beforeEach(() => {
  calls = []
  resetSlackApi(new SlackRateLimiter({ requestsPerMinute: 20, now: () => Date.now(), log: () => {} }))
  process.env.SOURCEFED_SLACK_TOKEN = "xoxb-test"
})

afterEach(() => {
  globalThis.fetch = realFetch
  if (realToken === undefined) delete process.env.SOURCEFED_SLACK_TOKEN
  else process.env.SOURCEFED_SLACK_TOKEN = realToken
})

test("monitors share one user list instead of fetching it on every poll", async () => {
  stubSlack({
    "conversations.replies": { ok: true, messages: [{ ts: "1.1", user: "U1", text: "hi" }] },
    "users.list": { ok: true, members: [{ id: "U1", name: "priya", real_name: "Priya Natarajan" }] },
  })

  const first = await fetchSlackThread("C1", "1.0", { monitorId: "m1" })
  const second = await fetchSlackThread("C2", "2.0", { monitorId: "m2" })
  assert.ok(!("deferred" in first) && !("deferred" in second))

  assert.deepEqual(second.users, [{ id: "U1", name: "priya", real_name: "Priya Natarajan" }])
  assert.equal(first.users, second.users)
  assert.deepEqual(calls, ["conversations.replies", "users.list", "conversations.replies"])
})

test("a rate-limited user list still returns the messages and holds no thread back", async () => {
  stubSlack({
    "conversations.replies": { ok: true, messages: [{ ts: "1.1", user: "U1", text: "hi" }] },
    "users.list": { ok: false, error: "ratelimited" },
  })

  const result = await fetchSlackThread("C1", "1.0", { monitorId: "m1" })
  assert.ok(!("deferred" in result))
  assert.equal(result.messages.length, 1)
  assert.deepEqual(result.users, [])

  const next = await fetchSlackThread("C2", "2.0", { monitorId: "m2" })
  assert.ok(!("deferred" in next))
  assert.deepEqual(calls, ["conversations.replies", "users.list", "conversations.replies"])
})

test("a failed read names Slack's error", async () => {
  stubSlack({ "conversations.replies": { ok: false, error: "not_in_channel" } })

  await assert.rejects(fetchSlackThread("C1", "1.0", { monitorId: "m1" }), /slack conversations\.replies failed: not_in_channel/)
})
