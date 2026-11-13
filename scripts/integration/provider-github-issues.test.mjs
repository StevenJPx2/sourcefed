import { createHmac } from "node:crypto"
import { assert, assertEqual, daemonEntry, removeDir, tempDir } from "./harness.mjs"

process.env.SOURCEFED_GITHUB_WEBHOOK_SECRET = "it-webhook-secret"
process.env.SOURCEFED_SLACK_SIGNING_SECRET = ""
process.env.GITHUB_TOKEN = "it-test-token"
const { SourcefedDaemon } = await import(daemonEntry())

const repo = "org/repo"
const issue = (number) => ({ number, title: `Issue ${number}`, html_url: `https://github.com/${repo}/issues/${number}`, state: "open" })
let open = [issue(48), issue(49)]
let etag = 'W/"one"'
const conditional = []
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  const href = String(url)
  if (!href.startsWith(`https://api.github.com/repos/${repo}/issues?`)) {
    return new Response(JSON.stringify({ message: "unexpected" }), { status: 404 })
  }
  const sent = init?.headers?.["if-none-match"]
  conditional.push(sent)
  if (sent === etag) return new Response(null, { status: 304, headers: { etag } })
  return new Response(JSON.stringify(open), { status: 200, headers: { "content-type": "application/json", etag } })
}

const dir = await tempDir("sourcefed-it-github-issues-")
const daemon = new SourcefedDaemon({ stateDir: dir })
try {
  await daemon.start()
  const target = { kind: "program", id: "it" }
  const created = await daemon.createMonitor(target, {
    name: "build",
    sourceType: "github-issues",
    repo,
    labels: ["atelier:build"],
    includeExisting: true,
  })
  assert(created.ok, `create github-issues monitor: ${created.error}`)

  const received = []
  daemon.subscribe(target, async (events) => { received.push(...events) })
  await daemon.runtime.tick()
  await daemon.runtime.tick()
  await new Promise((resolve) => setTimeout(resolve, 100))

  assertEqual(received.map((entry) => entry.event.subject?.number).join(","), "48,49", "includeExisting matches the current issues")
  assertEqual(conditional.length, 1, "the poll interval holds between ticks")

  open = [issue(49)]
  etag = 'W/"two"'
  const payload = JSON.stringify({ action: "unlabeled", issue: { number: 48 }, repository: { full_name: repo } })
  const signature = `sha256=${createHmac("sha256", process.env.SOURCEFED_GITHUB_WEBHOOK_SECRET).update(payload).digest("hex")}`
  const response = await daemon.webhook(new Request("http://127.0.0.1/webhooks/github", {
    method: "POST",
    headers: { "x-github-event": "issues", "x-github-delivery": "it-delivery-1", "x-hub-signature-256": signature },
    body: payload,
  }))
  assert(response.ok, `the issues webhook is verified and accepted (${response.status})`)

  await daemon.runtime.tick()
  await new Promise((resolve) => setTimeout(resolve, 100))

  const unmatched = received.filter((entry) => entry.event.kind === "item.unmatched")
  assertEqual(unmatched.length, 1, "the woken poll reports the unlabelled issue")
  assertEqual(unmatched[0].event.subject.key, `${repo}#48`)
  assertEqual(conditional[1], 'W/"one"', "the woken poll sends the stored ETag")

  await daemon.stop()
  console.log("provider-github-issues: list, ETag and a waking issues webhook through daemon ticks — ok")
} finally {
  await daemon.stop().catch(() => {})
  globalThis.fetch = realFetch
  await removeDir(dir)
}
