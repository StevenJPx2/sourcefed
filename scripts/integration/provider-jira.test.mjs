import { assert, assertEqual, removeDir, startJsonServer, tempDir } from "./harness.mjs"

let jiraCommentCalls = 0
const jiraMock = await startJsonServer((request, body) => {
  const pathname = new URL(request.url, "http://mock").pathname
  if (pathname.endsWith("/comment")) {
    jiraCommentCalls += 1
    const comments = [{
      id: "100",
      author: { displayName: "Steven John" },
      body: { content: [{ type: "paragraph", content: [{ type: "text", text: "hello from jira integration" }] }] },
    }]
    if (jiraCommentCalls >= 2) comments.push({
      id: "101",
      author: { displayName: "Alice" },
      body: { content: [{ type: "paragraph", content: [{ type: "text", text: "new comment after priming" }] }] },
    })
    return { body: { comments } }
  }
  if (pathname.endsWith("/issue/PROJ-1")) {
    return { body: {
      fields: { status: { name: "In Progress" }, description: { content: [{ type: "paragraph", content: [{ type: "text", text: "desc" }] }] } },
      changelog: { histories: [] },
    } }
  }
  return { status: 404, body: { error: `unexpected jira path ${pathname}` } }
})

process.env.SOURCEFED_JIRA_BASE_URL = `http://127.0.0.1:${jiraMock.port}`
process.env.SOURCEFED_GITHUB_WEBHOOK_SECRET = ""
process.env.SOURCEFED_SLACK_SIGNING_SECRET = ""
process.env.ATLASSIAN_EMAIL = "it@example.com"
process.env.ATLASSIAN_API_KEY = "test-key"
const { SourcefedDaemon } = await import("@sourcefed/daemon")

const dir = await tempDir("sourcefed-it-jira-")
const daemon = new SourcefedDaemon({ stateDir: dir })
try {
  await daemon.start()
  const target = { kind: "it", id: "jira-1" }
  const created = await daemon.createMonitor(target, { name: "PROJ-1", sourceType: "jira", issueKey: "PROJ-1" })
  assert(created.ok, "create jira monitor")

  const received = []
  daemon.subscribe(target, async (events) => { received.push(...events) })
  await daemon.runtime.tick()
  const polled = await daemon.service.get(created.monitor.id)
  await daemon.service.updateCursor(polled, "__lastPolledAt", 0)
  await daemon.runtime.tick()

  assertEqual(received.length, 1, "jira comment event after tick")
  assertEqual(received[0].event.summary, "Jira PROJ-1 comment by Alice")
  assert(received[0].event.body.includes("new comment after priming"), "comment body")
  await daemon.stop()
  console.log("provider-jira: mock Atlassian through daemon tick — ok")
} finally {
  await daemon.stop().catch(() => {})
  await jiraMock.stop()
  await removeDir(dir)
}
