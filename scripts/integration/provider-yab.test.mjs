import { chmod, writeFile } from "node:fs/promises"
import path from "node:path"
import { assert, assertEqual, removeDir, tempDir } from "./harness.mjs"

process.env.SOURCEFED_GITHUB_WEBHOOK_SECRET = ""
process.env.SOURCEFED_SLACK_SIGNING_SECRET = ""

const dir = await tempDir("sourcefed-it-yab-")
const calls = path.join(dir, "calls")
const fakeYab = path.join(dir, "yab")
// A stand-in for "yab mcp": answers fetch with an Atom feed that gains an entry on the second read.
await writeFile(fakeYab, `#!/usr/bin/env node
const fs = require("node:fs")
let buffer = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => {
  buffer += chunk
  let newline
  while ((newline = buffer.indexOf("\\n")) >= 0) {
    const message = JSON.parse(buffer.slice(0, newline))
    buffer = buffer.slice(newline + 1)
    if (message.method === "initialize") reply(message.id, { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "fake-yab", version: "0" } })
    if (message.method !== "tools/call") continue
    fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(message.params) + "\\n")
    const count = fs.readFileSync(${JSON.stringify(calls)}, "utf8").trim().split("\\n").length
    const entry = (id, title) => "<entry><title>" + title + "</title><summary>Hello</summary><id>" + id + "</id><issued>2026-11-06T10:00:00Z</issued><author><name>Recruiter</name><email>r@example.com</email></author></entry>"
    const feed = "<feed>" + entry("old", "Old mail") + (count >= 2 ? entry("new", "Interview invitation") : "") + "</feed>"
    reply(message.id, { content: [{ type: "text", text: "200 · text/xml · " + message.params.arguments.url + "\\n\\n" + feed }] })
  }
})
function reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\\n") }
`)
await chmod(fakeYab, 0o755)
process.env.SOURCEFED_YAB_COMMAND = fakeYab

const { SourcefedDaemon } = await import("@sourcefed/daemon")
const daemon = new SourcefedDaemon({ stateDir: path.join(dir, "state") })
try {
  await daemon.start()
  const target = { kind: "it", id: "yab-1" }
  const created = await daemon.createMonitor(target, {
    name: "inbox",
    sourceType: "yab",
    url: "https://mail.example.com/feed/atom",
    space: "Personal",
    match: "interview",
  })
  assert(created.ok, "create yab monitor")

  const received = []
  daemon.subscribe(target, async (events) => { received.push(...events) })
  await daemon.runtime.tick()
  const polled = await daemon.service.get(created.monitor.id)
  await daemon.service.updateCursor(polled, "__lastPolledAt", 0)
  await daemon.runtime.tick()

  assertEqual(received.length, 1, "yab feed event after tick")
  assertEqual(received[0].event.summary, "Yab feed entry from Recruiter <r@example.com>: Interview invitation")
  assertEqual(received[0].event.body, "Hello")

  await daemon.stop()
  console.log("provider-yab: fake yab mcp through daemon tick — ok")
} finally {
  await daemon.stop().catch(() => {})
  await removeDir(dir)
}
