import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { fetchSlackThread, resetSlackUsers } from "./slack-api.ts"

const realFetch = globalThis.fetch
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
  resetSlackUsers()
  process.env.SOURCEFED_SLACK_TOKEN = "xoxb-test"
})

afterEach(() => {
  globalThis.fetch = realFetch
})

test("monitors share one user list instead of fetching it on every poll", async () => {
  stubSlack({
    "conversations.replies": { ok: true, messages: [{ ts: "1.1", user: "U1", text: "hi" }] },
    "users.list": { ok: true, members: [{ id: "U1", name: "priya", real_name: "Priya Natarajan" }] },
  })

  const first = await fetchSlackThread("C1", "1.0")
  const second = await fetchSlackThread("C2", "2.0")

  assert.deepEqual(second.users, [{ id: "U1", name: "priya", real_name: "Priya Natarajan" }])
  assert.equal(first.users, second.users)
  assert.deepEqual(calls, ["conversations.replies", "users.list", "conversations.replies"])
})

test("a rate-limited user list still returns the messages", async () => {
  stubSlack({
    "conversations.replies": { ok: true, messages: [{ ts: "1.1", user: "U1", text: "hi" }] },
    "users.list": { ok: false, error: "ratelimited" },
  })

  const result = await fetchSlackThread("C1", "1.0")

  assert.equal(result.messages.length, 1)
  assert.deepEqual(result.users, [])
})

test("a failed read names Slack's error", async () => {
  stubSlack({ "conversations.replies": { ok: false, error: "not_in_channel" } })

  await assert.rejects(fetchSlackThread("C1", "1.0"), /slack conversations\.replies failed: not_in_channel/)
})
