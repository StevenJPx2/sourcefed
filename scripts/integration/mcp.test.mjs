import path from "node:path"
import { assert, assertEqual, removeDir, sleep, startJsonServer, startProcess, tempDir, waitForReachable } from "./harness.mjs"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"

const CLI = path.resolve("node_modules/@sourcefed/cli/dist/index.js")
const dir = await tempDir("sourcefed-it-mcp-")
const url = "http://127.0.0.1:18921"

let jiraCommentCalls = 0
const jiraMock = await startJsonServer((request, body) => {
  const pathname = new URL(request.url, "http://mock").pathname
  if (pathname.endsWith("/comment")) {
    jiraCommentCalls += 1
    const comments = [{
      id: "100",
      author: { displayName: "Steven John" },
      body: { content: [{ type: "paragraph", content: [{ type: "text", text: "mcp integration comment" }] }] },
    }]
    if (jiraCommentCalls >= 2) comments.push({
      id: "101",
      author: { displayName: "Alice" },
      body: { content: [{ type: "paragraph", content: [{ type: "text", text: "new comment" }] }] },
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

const env = {
  SOURCEFED_STATE_DIR: dir,
  SOURCEFED_JIRA_BASE_URL: `http://127.0.0.1:${jiraMock.port}`,
  ATLASSIAN_EMAIL: "it@example.com",
  ATLASSIAN_API_KEY: "test-key",
}
const mcpProcess = startProcess(process.execPath, [CLI, "mcp", "--http", "--port", "18921"], { env, silent: true })
try {
  await waitForReachable(url)

  const client = new Client({ name: "sourcefed-it", version: "0.0.0" }, { versionNegotiation: { mode: "auto" } })
  const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`))
  await client.connect(transport)

  const target = { kind: "it", id: "mcp-1" }
  const uri = `sourcefed://targets/${Buffer.from(JSON.stringify(target), "utf8").toString("base64url")}/events`

  await client.listen({ resourceSubscriptions: [uri] })

  const delivered = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for MCP event push")), 30_000)
    client.setNotificationHandler("notifications/resources/updated", async (notification) => {
      if (notification.params.uri !== uri) return
      const result = await client.readResource({ uri })
      const text = result.contents?.find((content) => "text" in content)?.text
      if (typeof text !== "string") return
      const parsed = JSON.parse(text)
      if (!parsed.events || parsed.events.length === 0) return
      clearTimeout(timer)
      resolve(parsed.events)
    })
  })

  const created = await client.callTool({
    name: "monitor_create",
    arguments: { name: "PROJ-1", sourceType: "jira", issueKey: "PROJ-1", pollIntervalSec: 15, target },
  })
  const createdContent = created.structuredContent ?? created.content?.[0]?.text
  assert(createdContent && createdContent.ok, "MCP tool created monitor")

  const events = await delivered
  assertEqual(events[0].event.summary, "Jira PROJ-1 comment by Alice", "event pushed through real MCP binary")
  await client.callTool({ name: "monitor_events_ack", arguments: { target, eventIDs: events.map((event) => event.id) } })
  const remaining = await client.readResource({ uri })
  const remainingText = remaining.contents?.find((content) => "text" in content)?.text
  assert(JSON.parse(remainingText).events.length === 0, "ack cleared the resource")

  await client.close()
  console.log("mcp: installed binary, resource subscription, event push, ack — ok")
} finally {
  await mcpProcess.stop().catch(() => {})
  await jiraMock.stop()
  await removeDir(dir)
}
