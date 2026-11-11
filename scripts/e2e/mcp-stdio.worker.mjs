import assert from "node:assert/strict"
import path from "node:path"
import { Client } from "@modelcontextprotocol/client"
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio"
import { cleanEnvironment, startJsonServer } from "./harness.mjs"

const cli = path.resolve("node_modules/@fdcn/sourcefed/dist/cli.js")
const fixture = await startJsonServer(() => ({ body: { fields: { status: { name: "Open" } }, changelog: { histories: [] }, comments: [] } }))
const client = new Client({ name: "sourcefed-release-stdio", version: "0" })
const transport = new StdioClientTransport({
  command: process.execPath, args: [cli, "mcp", "--stdio"],
  cwd: process.cwd(), env: cleanEnvironment({ SOURCEFED_STATE_DIR: process.env.SOURCEFED_STATE_DIR,
    SOURCEFED_JIRA_BASE_URL: `http://127.0.0.1:${fixture.port}`,
    ATLASSIAN_EMAIL: "release@example.invalid", ATLASSIAN_API_KEY: "fixture-key" }),
})

try {
  await client.connect(transport)
  const tools = await client.listTools()
  assert.ok(tools.tools.some((tool) => tool.name === "monitor_create"))
  const target = { kind: "release", id: "stdio" }
  const result = await client.callTool({ name: "monitor_create", arguments: {
    name: "release-stdio", sourceType: "jira", issueKey: "PROJ-1", target,
  } })
  assert.equal(result.structuredContent.ok, true)
  const uri = "sourcefed://targets/" + Buffer.from(JSON.stringify(target)).toString("base64url") + "/events"
  const resource = await client.readResource({ uri })
  assert.deepEqual(JSON.parse(resource.contents[0].text).events, [])
  const ack = await client.callTool({ name: "monitor_events_ack", arguments: { target, eventIDs: ["absent-event"] } })
  assert.equal(ack.structuredContent.ok, true)
  console.log("stdio: initialize, list tools, create monitor, resource read, idempotent ack")
} finally {
  await client.close()
  await fixture.stop()
}
