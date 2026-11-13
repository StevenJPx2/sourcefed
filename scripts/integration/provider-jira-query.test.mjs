import { assert, assertEqual, daemonEntry, removeDir, startJsonServer, tempDir } from "./harness.mjs"

const issue = (key) => ({ id: key.split("-")[1], key, fields: { summary: `Summary of ${key}` } })
let matching = ["PROJ-7", "PROJ-8"]
const queries = []
const jiraMock = await startJsonServer((request) => {
  const url = new URL(request.url, "http://mock")
  if (url.pathname !== "/rest/api/3/search/jql") return { status: 404, body: { errorMessages: [`unexpected path ${url.pathname}`] } }
  queries.push(url.searchParams.get("jql"))
  return { body: { issues: matching.map(issue), isLast: true } }
})

process.env.SOURCEFED_JIRA_BASE_URL = `http://127.0.0.1:${jiraMock.port}`
process.env.SOURCEFED_GITHUB_WEBHOOK_SECRET = ""
process.env.SOURCEFED_SLACK_SIGNING_SECRET = ""
process.env.ATLASSIAN_EMAIL = "it@example.com"
process.env.ATLASSIAN_API_KEY = "test-key"
const { SourcefedDaemon } = await import(daemonEntry())

const dir = await tempDir("sourcefed-it-jira-query-")
const daemon = new SourcefedDaemon({ stateDir: dir })
try {
  await daemon.start()
  const target = { kind: "program", id: "it" }
  const created = await daemon.createMonitor(target, { name: "agent", sourceType: "jira-query", jql: "labels = agent", includeExisting: true })
  assert(created.ok, `create jira-query monitor: ${created.error}`)

  const received = []
  daemon.subscribe(target, async (events) => { received.push(...events) })
  await daemon.runtime.tick()
  matching = ["PROJ-8", "PROJ-9"]
  const polled = await daemon.service.get(created.monitor.id)
  await daemon.service.updateCursor(polled, "__lastPolledAt", 0)
  await daemon.runtime.tick()
  await new Promise((resolve) => setTimeout(resolve, 100))

  const seen = received.map((entry) => `${entry.event.kind} ${entry.event.subject.key}`)
  assertEqual(seen.join(", "), "item.matched PROJ-7, item.matched PROJ-8, item.unmatched PROJ-7, item.matched PROJ-9")
  assertEqual(queries[0], "labels = agent ORDER BY key ASC")
  assertEqual(received[3].event.subject.url, `${process.env.SOURCEFED_JIRA_BASE_URL}/browse/PROJ-9`)
  await daemon.stop()
  console.log("provider-jira-query: mock Jira search through daemon ticks — ok")
} finally {
  await daemon.stop().catch(() => {})
  await jiraMock.stop()
  await removeDir(dir)
}
