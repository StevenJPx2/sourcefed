import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import path from "node:path"
import { pathToFileURL } from "node:url"

const [packageDir, state] = process.argv.slice(2)
const { SourcefedDaemon, serveHttp, handleDaemonHttpRequest } = await import(
  pathToFileURL(path.join(packageDir, "dist/daemon.js")).href
)
process.env.SOURCEFED_GITHUB_WEBHOOK_SECRET = "release-webhook-secret"
process.env.SOURCEFED_SLACK_SIGNING_SECRET = "release-webhook-secret"
const daemon = new SourcefedDaemon({ stateDir: state })
const server = await serveHttp({ hostname: "127.0.0.1", port: 0,
  handler: (request) => handleDaemonHttpRequest(daemon, request, { token: "rpc-token" }),
})
const base = `http://127.0.0.1:${server.port}`

try {
  const forbidden = await fetch(base + "/rpc", { method: "POST", body: "{}", signal: AbortSignal.timeout(1000) })
  assert.equal(forbidden.status, 401)
  await github()
  await slack()
  console.log("webhooks: signed GitHub/Slack HTTP delivery, invalid signatures, replay dedup, cursor persistence, ack")
} finally {
  await server.stop()
  await daemon.stop()
}

async function github() {
  const target = { kind: "release", id: "github-hook" }
  const created = await daemon.createMonitor(target, { name: "PR", sourceType: "github", repo: "org/repo", prNumber: 12 })
  assert.equal(created.ok, true)
  const body = JSON.stringify({ action: "created", repository: { full_name: "org/repo" },
    issue: { number: 12, pull_request: {} },
    comment: { id: 42, body: "release webhook", user: { login: "tester" }, created_at: new Date().toISOString() },
  })
  const signature = "sha256=" + createHmac("sha256", "release-webhook-secret").update(body).digest("hex")
  await deliver("github", body, { "x-hub-signature-256": signature,
    "x-github-event": "issue_comment", "x-github-delivery": "release-github-delivery" }, target, created.monitor.id)
}

async function slack() {
  const target = { kind: "release", id: "slack-hook" }
  const created = await daemon.createMonitor(target, { name: "thread", sourceType: "slack", channelId: "C123", threadTs: "100.000001" })
  assert.equal(created.ok, true)
  const body = JSON.stringify({ type: "event_callback", event_id: "release-slack-event",
    event: { type: "message", channel: "C123", thread_ts: "100.000001", ts: "100.000002", text: "release webhook", user: "U123" },
  })
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = "v0=" + createHmac("sha256", "release-webhook-secret").update(`v0:${timestamp}:${body}`).digest("hex")
  await deliver("slack", body, { "x-slack-signature": signature, "x-slack-request-timestamp": timestamp }, target, created.monitor.id)
}

async function deliver(provider, body, headers, target, monitorID) {
  const send = (signed) => fetch(base + "/webhooks/" + provider, {
    method: "POST", body, headers: { "content-type": "application/json", ...signed }, signal: AbortSignal.timeout(3000),
  })
  const invalid = await send({})
  assert.ok(invalid.status >= 400 && invalid.status < 500)
  await invalid.text()
  const accepted = await send(headers)
  const expected = provider === "slack" ? 202 : 200
  assert.equal(accepted.status, expected, await accepted.text())
  const deadline = Date.now() + 3000
  let events = []

  while (Date.now() < deadline) {
    events = await daemon.readEvents(target)
    if (events.length) break
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  assert.equal(events.length, 1, provider)
  const duplicate = await send(headers)
  assert.equal(duplicate.status, expected)
  await duplicate.text()
  assert.equal((await daemon.readEvents(target)).length, 1, "replay is deduplicated")
  assert.ok(Object.keys((await daemon.service.get(monitorID)).cursors).length > 0)
  await daemon.acknowledgeEvents(target, events.map((event) => event.id))
  assert.equal((await daemon.readEvents(target)).length, 0)
}
