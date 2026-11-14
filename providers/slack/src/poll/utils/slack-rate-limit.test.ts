import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, mock, test } from "node:test"
import { InMemoryMonitorStore, MonitorRuntime } from "@sourcefed/core"
import type { MonitorEvent, MonitorRecord } from "@sourcefed/core"
import type { SlackMessage } from "../../types/message.ts"
import { SlackMonitor } from "../../monitor.ts"
import { fetchSlackThread, resetSlackApi } from "./slack-api.ts"
import { SlackRateLimiter } from "./slack-limiter.ts"

// No test calls Slack: fetch is replaced by a fake Slack client, and Date by a fake clock.
const realFetch = globalThis.fetch
const realEnv = { ...process.env }
const START = Date.parse("2026-11-14T06:00:00.000Z")

type Call = { method: string; token: string; channel: string; at: number; status: number }
type Limit = { retryAfter?: number; fromPage?: number }

class FakeSlack {
  calls: Call[] = []
  limit: Limit | undefined
  pageSize = 1000
  threads = new Map<string, SlackMessage[]>()
  dms = new Map<string, SlackMessage[]>()

  install(): void {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const method = String(url).split("/").pop()!
      const params = new URLSearchParams(String(init.body))
      const token = String(new Headers(init.headers).get("authorization")).replace("Bearer ", "")
      const page = Number(params.get("cursor") ?? 0)
      const call: Call = { method, token, channel: params.get("channel") ?? "", at: Date.now(), status: 200 }
      this.calls.push(call)
      if (method === "users.list") return Response.json({ ok: true, members: [{ id: "U1", name: "priya", real_name: "Priya" }] })
      if (this.limit && page >= (this.limit.fromPage ?? 0)) {
        call.status = 429
        const headers: Record<string, string> = this.limit.retryAfter ? { "retry-after": String(this.limit.retryAfter) } : {}
        return Response.json({ ok: false, error: "ratelimited" }, { status: 429, headers })
      }
      return Response.json(this.read(method, params, page))
    }) as typeof fetch
  }

  private read(method: string, params: URLSearchParams, page: number): unknown {
    const oldest = Number(params.get("oldest") ?? 0)
    const all = method === "conversations.replies"
      ? this.threads.get(`${params.get("channel")}#${params.get("ts")}`) ?? [{ ts: params.get("ts")!, user: "U1", text: "parent" }]
      : [...(this.dms.get(params.get("channel")!) ?? [])].reverse()
    const matching = all.filter((message) => Number(message.ts) > oldest)
    const messages = matching.slice(page * this.pageSize, (page + 1) * this.pageSize)
    const more = (page + 1) * this.pageSize < matching.length
    return { ok: true, messages, response_metadata: { next_cursor: more ? String(page + 1) : "" } }
  }

  reads(): Call[] {
    return this.calls.filter((call) => call.method !== "users.list")
  }
}

let slack: FakeSlack
let logs: string[]
let failures: string[]

function limiter(requestsPerMinute = 20): SlackRateLimiter {
  return new SlackRateLimiter({ requestsPerMinute, now: () => Date.now(), log: (line) => logs.push(line) })
}

function advance(ms: number): void {
  mock.timers.tick(ms)
}

const PARENT: SlackMessage = { ts: "1.000000", user: "U1", text: "parent" }

function reply(ts: number, text: string): SlackMessage {
  return { ts: `${ts}.000001`, user: "U1", text }
}

beforeEach(() => {
  delete process.env.SOURCEFED_SLACK_SIGNING_SECRET
  process.env.SOURCEFED_SLACK_TOKEN = "xoxb-a"
  mock.timers.enable({ apis: ["Date"], now: START })
  logs = []
  failures = []
  mock.method(console, "error", (...args: unknown[]) => failures.push(args.map(String).join(" ")))
  slack = new FakeSlack()
  slack.install()
  resetSlackApi(limiter())
})

afterEach(() => {
  globalThis.fetch = realFetch
  process.env = { ...realEnv }
  mock.timers.reset()
  mock.restoreAll()
})

async function runtimeWith(threads: number): Promise<{ runtime: MonitorRuntime; delivered: MonitorEvent[]; records: MonitorRecord[] }> {
  const delivered: MonitorEvent[] = []
  const runtime = new MonitorRuntime({
    store: new InMemoryMonitorStore(),
    sink: { deliver: async ({ event }) => { delivered.push(event); return { ok: true } } },
    sources: { slack: new SlackMonitor() },
    sourceForWebhookPath: () => undefined,
  })
  const records: MonitorRecord[] = []
  for (let index = 1; index <= threads; index++) {
    const { monitor } = await runtime.service.create({
      name: `thread ${index}`,
      source: { type: "slack", channelId: `C${index}`, threadTs: `${index}.000000` },
      delivery: "poll",
      target: { kind: "test", id: `session-${index}` },
      pollIntervalSec: 60,
    })
    records.push(monitor)
  }
  return { runtime, delivered, records }
}

async function runFor(runtime: MonitorRuntime, ms: number, everyMs = 5_000): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += everyMs) {
    advance(everyMs)
    await runtime.tick()
  }
}

describe("Slack rate limits", () => {
  test("Retry-After holds every monitor on the token, and another token is unaffected", async () => {
    assert.ok(!("deferred" in await fetchSlackThread("C2", "2.0", { monitorId: "m2" })))
    slack.limit = { retryAfter: 30 }
    assert.deepEqual(await fetchSlackThread("C1", "1.0", { monitorId: "m1" }), { deferred: true })
    slack.limit = undefined

    assert.deepEqual(await fetchSlackThread("C2", "2.0", { monitorId: "m2" }), { deferred: true })
    advance(29_000)
    assert.deepEqual(await fetchSlackThread("C1", "1.0", { monitorId: "m1" }), { deferred: true })
    assert.equal(slack.reads().length, 2, "no monitor on the token polls during the wait")

    process.env.SOURCEFED_SLACK_TOKEN = "xoxb-b"
    assert.ok(!("deferred" in await fetchSlackThread("C3", "3.0", { monitorId: "m3" })))
    assert.deepEqual(slack.reads().map((call) => call.token), ["xoxb-a", "xoxb-a", "xoxb-b"])

    process.env.SOURCEFED_SLACK_TOKEN = "xoxb-a"
    advance(4_000)
    assert.ok(!("deferred" in await fetchSlackThread("C2", "2.0", { monitorId: "m2" })), "the first monitor held back goes first")
    assert.deepEqual(await fetchSlackThread("C1", "1.0", { monitorId: "m1" }), { deferred: true })
    advance(3_000)
    assert.ok(!("deferred" in await fetchSlackThread("C1", "1.0", { monitorId: "m1" })))

    assert.deepEqual(logs, [
      "[sourcefed] Slack rate-limited conversations.replies: waiting 30s before polling 2 Slack monitors on this token again",
    ])
  })

  test("a rate limit without Retry-After waits a minute", async () => {
    slack.limit = {}
    assert.deepEqual(await fetchSlackThread("C1", "1.0", { monitorId: "m1" }), { deferred: true })
    slack.limit = undefined
    advance(59_000)
    assert.deepEqual(await fetchSlackThread("C1", "1.0", { monitorId: "m1" }), { deferred: true })
    advance(4_000)
    assert.ok(!("deferred" in await fetchSlackThread("C1", "1.0", { monitorId: "m1" })))
    assert.match(logs[0]!, /waiting 60s/)
  })

  test("a monitor that stops asking does not hold the queue", () => {
    const shared = limiter()
    assert.equal(shared.acquire("xoxb-a", "m1"), true)
    assert.equal(shared.acquire("xoxb-a", "m2"), true)
    assert.equal(shared.acquire("xoxb-a", "m3"), false)
    assert.equal(shared.acquire("xoxb-a", "m4"), false)

    // m3 is removed and never asks again; m4 keeps asking every tick.
    advance(5_000)
    assert.equal(shared.acquire("xoxb-a", "m4"), false, "m3 keeps its turn through overlapping ticks")
    advance(15_000)
    assert.equal(shared.acquire("xoxb-a", "m4"), true)
  })

  test("logs one line per wait, not per refused call", () => {
    const shared = limiter()
    shared.acquire("xoxb-a", "m1")
    shared.pause("xoxb-a", 30, "conversations.replies")
    assert.equal(shared.acquire("xoxb-a", "m2"), false)
    advance(10_000)
    shared.pause("xoxb-a", 30, "conversations.replies")
    assert.equal(logs.length, 1)
    assert.equal(shared.pausedUntil("xoxb-a"), START + 40_000)

    advance(31_000)
    shared.pause("xoxb-a", 5, "conversations.replies")
    assert.equal(logs.length, 2)
  })
})

describe("Slack monitors under a rate limit", () => {
  test("a wait holds back every monitor, keeps the cursor, and the next poll picks up once", async () => {
    const { runtime, delivered, records } = await runtimeWith(2)
    await runtime.tick()
    const primed = (await runtime.service.get(records[0]!.id))!.cursors["slack:C1#1.000000"]

    advance(60_000)
    slack.threads.set("C1#1.000000", [PARENT, reply(1_794_000_100, "a reply during the wait")])
    slack.limit = { retryAfter: 30 }
    await runtime.tick()
    slack.limit = undefined
    const limitedAt = Date.now()
    const held = (await runtime.service.get(records[0]!.id))!
    assert.deepEqual(held.cursors["slack:C1#1.000000"], primed)
    assert.equal(held.cursors.__lastAttemptAt, undefined)

    await runFor(runtime, 120_000)

    const during = slack.reads().filter((call) => call.at > limitedAt && call.at < limitedAt + 30_000)
    assert.deepEqual(during, [], "no monitor on the token polls during the wait")
    assert.deepEqual(delivered.map((event) => event.body), ["a reply during the wait"])
    assert.deepEqual(failures, [], "a rate limit is not a monitor failure")
    assert.deepEqual(logs, [
      "[sourcefed] Slack rate-limited conversations.replies: waiting 30s before polling 2 Slack monitors on this token again",
    ])
  })

  test("a limit part-way through a thread keeps what was read and continues from it", async () => {
    const { runtime, delivered } = await runtimeWith(1)
    await runtime.tick()
    slack.pageSize = 2
    slack.threads.set("C1#1.000000", [PARENT, ...[1, 2, 3, 4, 5].map((n) => reply(1_794_000_000 + n, `reply ${n}`))])
    slack.limit = { retryAfter: 10, fromPage: 1 }
    advance(60_000)
    await runtime.tick()
    slack.limit = undefined
    assert.deepEqual(delivered.map((event) => event.body), ["reply 1", "reply 2"])

    await runFor(runtime, 5 * 60_000)
    assert.deepEqual(delivered.map((event) => event.body), ["reply 1", "reply 2", "reply 3", "reply 4", "reply 5"])
  })

  test("a limit part-way through a DM defers the whole read, then reads it once", async () => {
    const delivered: MonitorEvent[] = []
    const runtime = new MonitorRuntime({
      store: new InMemoryMonitorStore(),
      sink: { deliver: async ({ event }) => { delivered.push(event); return { ok: true } } },
      sources: { slack: new SlackMonitor() },
      sourceForWebhookPath: () => undefined,
    })
    await runtime.service.create({ name: "dm", source: { type: "slack", channelId: "D1" }, delivery: "poll", target: { kind: "test", id: "s" }, pollIntervalSec: 60 })
    slack.dms.set("D1", [reply(1, "old")])
    await runtime.tick()
    slack.pageSize = 2
    slack.dms.set("D1", [reply(1, "old"), ...[1, 2, 3, 4, 5].map((n) => reply(1_794_000_000 + n, `dm ${n}`))])
    slack.limit = { retryAfter: 10, fromPage: 1 }
    advance(60_000)
    await runtime.tick()
    slack.limit = undefined
    assert.equal(delivered.length, 0)

    await runFor(runtime, 3 * 60_000)
    assert.deepEqual(delivered.map((event) => event.body).sort(), ["dm 1", "dm 2", "dm 3", "dm 4", "dm 5"])
  })

  test("a monitor waiting its turn does not show as unresponsive", async () => {
    resetSlackApi(limiter(1))
    const { runtime, records } = await runtimeWith(8)
    await runtime.tick()
    await runFor(runtime, 6 * 60_000)

    const monitor = new SlackMonitor()
    for (const record of records) {
      const current = (await runtime.service.get(record.id))!
      assert.equal(monitor.unresponsive(current, Date.now()), false, `${current.name} is waiting, not failing`)
    }
  })

  test("32 monitors on one token stay within its budget", async () => {
    const { runtime } = await runtimeWith(32)
    await runtime.tick()
    await runFor(runtime, 10 * 60_000)

    const times = slack.reads().map((call) => call.at)
    const busiestMinute = Math.max(...times.map((start) => times.filter((at) => at >= start && at < start + 60_000).length))
    assert.ok(busiestMinute <= 20 + 2, `busiest minute had ${busiestMinute} requests`)
    assert.ok(times.length <= 20 * 10 + 2, `${times.length} requests in ten minutes`)

    const perMonitor = new Map<string, number>()
    for (const call of slack.reads()) perMonitor.set(call.channel, (perMonitor.get(call.channel) ?? 0) + 1)
    assert.deepEqual(failures, [])
    assert.equal(perMonitor.size, 32)
    assert.ok(Math.min(...perMonitor.values()) >= 4, "every monitor gets its turn")
    assert.deepEqual(logs, [])
  })

  test("every monitor gets its turn when the runtime ticks only once a minute", async () => {
    const { runtime } = await runtimeWith(32)
    await runtime.tick()
    await runFor(runtime, 40 * 60_000, 60_000)

    const perMonitor = new Map<string, number>()
    for (const call of slack.reads()) perMonitor.set(call.channel, (perMonitor.get(call.channel) ?? 0) + 1)
    assert.equal(perMonitor.size, 32)
    assert.ok(Math.min(...perMonitor.values()) >= 2, `fewest polls for one monitor: ${Math.min(...perMonitor.values())}`)
  })
})
