import { assert, assertEqual, removeDir, tempDir } from "./harness.mjs"

process.env.SOURCEFED_GITHUB_WEBHOOK_SECRET = ""
process.env.SOURCEFED_SLACK_SIGNING_SECRET = ""
process.env.SOURCEFED_SLACK_TOKEN = "it-test-token"
const { SourcefedDaemon } = await import("@sourcefed/daemon")

let repliesCalls = 0
const repliesFixture = (calls) => ({
  ok: true,
  messages: [{
    type: "message",
    ts: "1722890000.000001",
    user: "U1",
    text: "hello from the slack thread",
  }].concat(calls >= 2 ? [{
    type: "message",
    ts: "1722890000.000002",
    user: "U2",
    text: "new slack message after priming",
  }] : []),
  response_metadata: { next_cursor: "" },
})

const usersFixture = {
  ok: true,
  members: [
    { id: "U1", name: "steven", real_name: "Steven John" },
    { id: "U2", name: "alice", real_name: "Alice" },
  ],
}

const realFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  const href = String(url)
  if (href.includes("/api/conversations.replies")) {
    repliesCalls += 1
    return new Response(JSON.stringify(repliesFixture(repliesCalls)), { status: 200, headers: { "content-type": "application/json" } })
  }
  if (href.includes("/api/users.list")) {
    return new Response(JSON.stringify(usersFixture), { status: 200, headers: { "content-type": "application/json" } })
  }
  return new Response(JSON.stringify({ ok: false, error: "unexpected" }), { status: 404 })
}

const dir = await tempDir("sourcefed-it-slack-")
const daemon = new SourcefedDaemon({ stateDir: dir })
try {
  await daemon.start()
  const target = { kind: "it", id: "slack-1" }
  const created = await daemon.createMonitor(target, {
    name: "thread",
    sourceType: "slack",
    channelId: "C123",
    threadTs: "1722890000.000000",
  })
  assert(created.ok, "create slack monitor")

  const received = []
  daemon.subscribe(target, async (events) => { received.push(...events) })
  await daemon.runtime.tick()
  const polled = await daemon.service.get(created.monitor.id)
  await daemon.service.updateCursor(polled, "__lastPolledAt", 0)
  await daemon.runtime.tick()

  assertEqual(received.length, 1, "slack message event after tick")
  assertEqual(received[0].event.summary, "Slack thread message by Alice")
  assertEqual(received[0].event.body, "new slack message after priming")
  assert(repliesCalls >= 1, "conversations.replies called")

  await daemon.stop()
  console.log("provider-slack: mocked Slack Web API through daemon tick — ok")
} finally {
  await daemon.stop().catch(() => {})
  globalThis.fetch = realFetch
  await removeDir(dir)
}
