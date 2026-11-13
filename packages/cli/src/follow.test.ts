import assert from "node:assert/strict"
import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"
import { describe, test } from "node:test"
import { InMemoryMonitorEventQueue, InMemoryMonitorStore } from "@sourcefed/core"
import { handleDaemonHttpRequest, serveHttp, SourcefedDaemon } from "@sourcefed/daemon"
import { fileURLToPath } from "node:url"

const CLI = fileURLToPath(new URL("../dist/index.js", import.meta.url))
const run = promisify(execFile)

describe("monitor follow", () => {
  test("streams delivered events over SSE until interrupted", async () => {
    const daemon = new SourcefedDaemon({ store: new InMemoryMonitorStore(), eventQueue: new InMemoryMonitorEventQueue() })
    const server = await serveHttp({
      hostname: "127.0.0.1",
      port: 0,
      handler: (request: Request) => handleDaemonHttpRequest(daemon, request),
    })

    const target = { kind: "it", id: "follow-1" }
    const created = await daemon.createMonitor(target, { name: "PROJ-1", sourceType: "jira", issueKey: "PROJ-1" })
    const record = created.ok && created.monitor ? await daemon.service.get(created.monitor.id) : undefined
    assert(record, "monitor created")

    const child = spawn(process.execPath, [CLI, "monitor", "follow", "--target-kind", "it", "--target-id", "follow-1"], {
      env: { ...process.env, SOURCEFED_DAEMON_URL: `http://127.0.0.1:${server.port}` },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let output = ""
    child.stdout.on("data", (chunk) => { output += chunk })
    child.stderr.on("data", (chunk) => { output += chunk })

    await new Promise((resolve) => setTimeout(resolve, 500))
    await daemon.runtime.context.sink.deliver({
      monitor: record,
      event: {
        source: record.source,
        kind: "comment",
        id: "comment:1",
        at: "2026-08-05T00:01:00.000Z",
        summary: "follow delivered comment",
        body: "hello",
        actionable: true,
      },
    })

    const deadline = Date.now() + 5_000
    while (Date.now() < deadline && !output.includes("follow delivered comment")) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    child.kill()
    await server.stop()
    await daemon.stop()

    assert(output.includes("following events for it:follow-1"), "prints the subscribe notice")
    assert(output.includes("follow delivered comment"), "streams the delivered event")
  })

  test("--json prints events in order, leaves them unacknowledged, and sends them again", async () => {
    const daemon = new SourcefedDaemon({ store: new InMemoryMonitorStore(), eventQueue: new InMemoryMonitorEventQueue() })
    const server = await serveHttp({
      hostname: "127.0.0.1",
      port: 0,
      handler: (request: Request) => handleDaemonHttpRequest(daemon, request),
    })
    const env = { ...process.env, SOURCEFED_DAEMON_URL: `http://127.0.0.1:${server.port}` }
    const targetFlags = ["--target-kind", "program", "--target-id", "atelier"]
    const target = { kind: "program", id: "atelier" }

    try {
      const created = await daemon.createMonitor(target, { name: "PROJ-1", sourceType: "jira", issueKey: "PROJ-1" })
      const record = created.ok && created.monitor ? await daemon.service.get(created.monitor.id) : undefined
      assert(record, "monitor created")
      for (const id of ["item:1", "item:2"]) {
        await daemon.runtime.context.sink.deliver({
          monitor: record,
          event: { source: record.source, kind: "item.matched", id, at: "2026-11-13T10:00:00.000Z", summary: id, actionable: true },
        })
      }

      const first = await followLines(env, targetFlags, 2)
      assert.deepEqual(first.map((line) => line.event.id), ["item:1", "item:2"])
      assert.equal((await daemon.readEvents(target)).length, 2, "printing acknowledges nothing")

      const again = await followLines(env, targetFlags, 2)
      assert.deepEqual(again.map((line) => line.id), first.map((line) => line.id))

      const ids = first.flatMap((line) => ["--event-id", line.id])
      await run(process.execPath, [CLI, "monitor", "ack", ...targetFlags, ...ids], { env })
      assert.equal((await daemon.readEvents(target)).length, 0, "monitor ack acknowledges them")
    } finally {
      await server.stop()
      await daemon.stop()
    }
  })
})

async function followLines(env: NodeJS.ProcessEnv, targetFlags: string[], count: number): Promise<Array<{ id: string; event: { id: string } }>> {
  const child = spawn(process.execPath, [CLI, "monitor", "follow", "--json", ...targetFlags], { env, stdio: ["ignore", "pipe", "pipe"] })
  let output = ""
  child.stdout.on("data", (chunk) => { output += chunk })
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline && output.split("\n").filter(Boolean).length < count) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  child.kill()
  await new Promise((resolve) => child.once("exit", resolve))
  return output.split("\n").filter(Boolean).map((line) => JSON.parse(line))
}
