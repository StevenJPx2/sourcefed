import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, mock, test } from "node:test"
import { InMemoryMonitorStore, MonitorRuntime } from "@sourcefed/core"
import type { MonitorEvent, MonitorRecord } from "@sourcefed/core"
import type { SlackMessage } from "../../types/message.ts"
import { SlackMonitor } from "../../monitor.ts"
import { fetchSlackThread, resetSlackApi, retryAfter } from "./slack-api.ts"
import { MAX_RETRY_AFTER_SEC, SlackRateLimiter, slackRequestsPerMinute } from "./slack-limiter.ts"

// No test calls Slack: fetch is replaced by a fake Slack client, and Date by a fake clock.
const realFetch = globalThis.fetch
const ENV_KEYS = ["SOURCEFED_SLACK_TOKEN", "SOURCEFED_SLACK_SIGNING_SECRET"] as const
const realEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
const START = Date.parse("2026-11-14T06:00:00.000Z")

type Call = { method: string; token: string; channel: string; page: number; at: number; status: number }
type Limit = { retryAfter?: number; fromPage?: number; channel?: string; status?: number }

class FakeSlack {
  calls: Call[] = []
  limit: Limit | undefined
  pageSize = 1000
  threads = new Map<string, SlackMessage[]>()
  dms = new Map<string, SlackMessage[]>()
  // Answers for "<channel>:<page>" wait for this promise, so a test can overlap two polls.
  holds = new Map<string, Promise<void>>()

  install(): void {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const method = String(url).split("/").pop()!
      const params = new URLSearchParams(String(init.body))
      const token = String(new Headers(init.headers).get("authorization")).replace("Bearer ", "")
      const page = Number(params.get("cursor") ?? 0)
      const channel = params.get("channel") ?? ""
      const call: Call = { method, token, channel, page, at: Date.now(), status: 200 }
      this.calls.push(call)
      if (method === "users.list") return Response.json({ ok: true, members: [{ id: "U1", name: "priya", real_name: "Priya" }] })
      await this.holds.get(`${channel}:${page}`)
      const limit = this.limit
      if (limit && page >= (limit.fromPage ?? 0) && (limit.channel === undefined || limit.channel === channel)) {
        call.status = limit.status ?? 429
        const headers: Record<string, string> = limit.retryAfter ? { "retry-after": String(limit.retryAfter) } : {}
        return Response.json({ ok: false, error: "ratelimited" }, { status: call.status, headers })
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
  for (const key of ENV_KEYS) {
    if (realEnv[key] === undefined) delete process.env[key]
    else process.env[key] = realEnv[key]
  }
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
    assert.equal(shared.burst, 3)
    assert.equal(shared.acquire("xoxb-a", "m0"), true)
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

  test("logs one line per wait, once every monitor held back has asked", () => {
    const shared = limiter()
    assert.equal(shared.acquire("xoxb-a", "m1"), true)
    shared.pause("xoxb-a", 30, "conversations.replies", "m1")
    assert.equal(shared.acquire("xoxb-a", "m2"), false)
    assert.equal(shared.acquire("xoxb-a", "m3"), false)
    advance(10_000)
    shared.pause("xoxb-a", 30, "conversations.replies", "m2")
    assert.deepEqual(logs, [], "nothing is logged before a whole tick of the wait")

    assert.equal(shared.acquire("xoxb-a", "m1"), false)
    assert.equal(shared.acquire("xoxb-a", "m2"), false)
    assert.equal(shared.acquire("xoxb-a", "m4"), false)
    assert.deepEqual(logs, [
      "[sourcefed] Slack rate-limited conversations.replies: waiting 40s before polling 3 Slack monitors on this token again",
    ])

    advance(31_000)
    assert.equal(shared.acquire("xoxb-a", "m1"), false, "the budget refills after the wait")
    shared.pause("xoxb-a", 5, "conversations.history", "m1")
    advance(6_000)
    shared.acquire("xoxb-a", "m2")
    assert.equal(logs.length, 2, "a wait that ends before the monitor asks again is logged when it ends")
    assert.match(logs[1]!, /conversations\.history: waiting 5s before polling 1 Slack monitor on/)
  })

  test("a Retry-After longer than an hour is capped, and the log says so", async () => {
    slack.limit = { retryAfter: 86_400 }
    assert.deepEqual(await fetchSlackThread("C1", "1.0", { monitorId: "m1" }), { deferred: true })
    slack.limit = undefined
    advance(MAX_RETRY_AFTER_SEC * 1000 - 1_000)
    assert.deepEqual(await fetchSlackThread("C1", "1.0", { monitorId: "m1" }), { deferred: true })
    assert.deepEqual(logs, [
      "[sourcefed] Slack rate-limited conversations.replies: waiting 3600s (Slack asked for 86400s; waits are capped at 3600s) before polling 1 Slack monitor on this token again",
    ])
    advance(4_000)
    assert.ok(!("deferred" in await fetchSlackThread("C1", "1.0", { monitorId: "m1" })))
  })

  test("ratelimited in an HTTP 200 answer waits like a 429", async () => {
    slack.limit = { status: 200, retryAfter: 10 }
    assert.deepEqual(await fetchSlackThread("C1", "1.0", { monitorId: "m1" }), { deferred: true })
    slack.limit = undefined
    assert.deepEqual(await fetchSlackThread("C2", "2.0", { monitorId: "m2" }), { deferred: true })
    assert.equal(slack.reads().length, 1)
    advance(14_000)
    assert.ok(!("deferred" in await fetchSlackThread("C1", "1.0", { monitorId: "m1" })))
  })

  test("Retry-After values", () => {
    const cases: Array<[string | undefined, number]> = [
      ["30", 30],
      ["2.5", 3],
      ["0", 1],
      ["86400", 86_400],
      ["soon", 60],
      ["-5", 60],
      ["", 60],
      [undefined, 60],
    ]
    for (const [header, seconds] of cases) {
      const response = new Response(null, { status: 429, headers: header === undefined ? {} : { "retry-after": header } })
      assert.equal(retryAfter(response), seconds, `Retry-After ${JSON.stringify(header)}`)
    }
  })

  test("SOURCEFED_SLACK_REQUESTS_PER_MINUTE values", () => {
    const cases: Array<[string | undefined, number, boolean]> = [
      [undefined, 20, false],
      ["", 20, false],
      ["1", 1, false],
      ["0.5", 0.5, false],
      ["50", 50, false],
      ["51", 50, true],
      ["1e9", 50, true],
      ["0", 20, true],
      ["-3", 20, true],
      ["fast", 20, true],
      ["Infinity", 20, true],
    ]
    for (const [value, expected, warns] of cases) {
      const warnings: string[] = []
      assert.equal(slackRequestsPerMinute(value, (line) => warnings.push(line)), expected, `value ${JSON.stringify(value)}`)
      assert.equal(warnings.length, warns ? 1 : 0, `warnings for ${JSON.stringify(value)}`)
    }
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

  test("the log counts every monitor held back, even on the first request after start", async () => {
    const { runtime } = await runtimeWith(32)
    slack.limit = { retryAfter: 30 }
    await runtime.tick()
    slack.limit = undefined
    assert.equal(slack.reads().length, 1)
    assert.deepEqual(logs, [])

    await runFor(runtime, 5_000)
    assert.deepEqual(logs, [
      "[sourcefed] Slack rate-limited conversations.replies: waiting 30s before polling 32 Slack monitors on this token again",
    ])
  })

  test("a read part-way through its pages stops when an overlapping tick hits a limit", async () => {
    const delivered: MonitorEvent[] = []
    const runtime = new MonitorRuntime({
      store: new InMemoryMonitorStore(),
      sink: { deliver: async ({ event }) => { delivered.push(event); return { ok: true } } },
      sources: { slack: new SlackMonitor() },
      sourceForWebhookPath: () => undefined,
    })
    const create = (name: string, source: { type: "slack"; channelId: string; threadTs?: string }) =>
      runtime.service.create({ name, source, delivery: "poll", target: { kind: "test", id: name }, pollIntervalSec: 60 })
    await create("dm", { type: "slack", channelId: "D1" })
    await create("thread", { type: "slack", channelId: "C2", threadTs: "2.000000" })
    slack.dms.set("D1", [reply(1, "old")])
    await runtime.tick()

    advance(60_000)
    slack.pageSize = 2
    slack.dms.set("D1", [reply(1, "old"), ...[1, 2, 3, 4, 5].map((n) => reply(1_794_000_000 + n, `dm ${n}`))])
    let release!: () => void
    slack.holds.set("D1:0", new Promise((resolve) => { release = resolve }))
    const first = runtime.tick()
    while (!slack.calls.some((call) => call.channel === "D1" && call.at === Date.now())) await new Promise((resolve) => setImmediate(resolve))

    slack.limit = { retryAfter: 30, channel: "C2" }
    await runtime.tick()
    slack.limit = undefined
    const limitedAt = slack.calls.findIndex((call) => call.status === 429)
    assert.ok(limitedAt >= 0)
    release()
    await first

    const early = slack.calls.slice(limitedAt + 1).filter((call) => call.at < Date.now() + 30_000 && call.method !== "users.list")
    assert.deepEqual(early, [], "no page goes out during the wait")
    assert.equal(delivered.length, 0)

    await runFor(runtime, 3 * 60_000)
    assert.deepEqual(delivered.map((event) => event.body).sort(), ["dm 1", "dm 2", "dm 3", "dm 4", "dm 5"])
    assert.deepEqual(failures, [])
  })

  test("a new monitor's first read goes ahead of monitors waiting their turn", async () => {
    const { runtime, delivered } = await runtimeWith(32)
    await runtime.tick()
    await runFor(runtime, 3 * 60_000)

    const createdAt = Date.now()
    await runtime.service.create({
      name: "new thread",
      source: { type: "slack", channelId: "C99", threadTs: "99.000000" },
      delivery: "poll",
      target: { kind: "test", id: "session-99" },
      pollIntervalSec: 60,
    })
    await runFor(runtime, 10_000)
    const firstRead = slack.reads().find((call) => call.channel === "C99")
    assert.ok(firstRead, "the new monitor read within two ticks")
    assert.ok(firstRead.at - createdAt <= 10_000)

    slack.threads.set("C99#99.000000", [{ ts: "99.000000", user: "U1", text: "parent" }, reply(1_794_000_200, "first reply")])
    await runFor(runtime, 5 * 60_000)
    assert.ok(delivered.some((event) => event.body === "first reply"))
  })

  test("a monitor deferred for a long time shows as unresponsive in the end", async () => {
    const { runtime, records } = await runtimeWith(1)
    await runtime.tick()
    advance(60_000)
    slack.limit = { retryAfter: MAX_RETRY_AFTER_SEC }
    await runtime.tick()
    slack.limit = undefined

    const monitor = new SlackMonitor()
    await runFor(runtime, 20 * 60_000, 30_000)
    assert.equal(monitor.unresponsive((await runtime.service.get(records[0]!.id))!, Date.now()), false, "waiting 20 minutes")
    await runFor(runtime, 20 * 60_000, 30_000)
    assert.equal(monitor.unresponsive((await runtime.service.get(records[0]!.id))!, Date.now()), true, "deferred 40 minutes")
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
    const burst = limiter().burst
    assert.ok(busiestMinute <= 20 + burst, `busiest minute had ${busiestMinute} requests`)
    assert.ok(times.length <= 20 * 10 + burst, `${times.length} requests in ten minutes`)
    assert.ok(times.length >= 19 * 10, `the budget is used, not wasted: ${times.length} requests in ten minutes`)

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
