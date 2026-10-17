import assert from "node:assert/strict"
import { test } from "node:test"
import { InMemoryMonitorEventQueue, InMemoryMonitorStore, type MonitorTarget, type QueuedMonitorEvent } from "@sourcefed/core"
import { SourcefedDaemon, handleDaemonHttpRequest, serveHttp } from "@sourcefed/daemon"
import { setupSourcefed } from "./index.ts"
import { OpenCodeBridge } from "./bridge.ts"

type Context = Parameters<typeof setupSourcefed>[0]
type Editor = Parameters<Parameters<Context["tool"]["transform"]>[0]>[0]
type Tool = Parameters<Editor["add"]>[0]

class CountingDaemon extends SourcefedDaemon {
  active = 0
  peak = 0
  override subscribe(target: MonitorTarget, listener: (events: QueuedMonitorEvent[]) => void): () => void {
    this.peak = Math.max(this.peak, ++this.active)
    const unsubscribe = super.subscribe(target, listener)
    return () => { this.active -= 1; unsubscribe() }
  }
}

async function until(check: () => boolean | Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 3_000
  while (!(await check()) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10))
  assert.ok(await check(), "condition did not become true")
}

function context(projectID: string, sessionID: string, failRegistration = false) {
  const tools: Tool[] = []
  const delivered: string[] = []
  const directory = `/test/${projectID}`
  const session: ConstructorParameters<typeof OpenCodeBridge>[0] = {
    // Session reads are intentionally global, like the V2 server API.
    get: async ({ sessionID: id }) => ({
      id, projectID: id.replace("ses_", "project_"), location: { directory: `/test/${id.replace("ses_", "project_")}` },
      cost: 0, time: { created: 0, updated: 0 },
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    }),
    synthetic: async (message) => {
      delivered.push(message.sessionID)
      return { id: "msg_test", sessionID: message.sessionID, time: { created: 0 }, type: "synthetic", payload: { text: message.text }, delivery: "steer" }
    },
  }
  const editor: Editor = {
    add: (tool) => { tools.push(tool) }, list: () => [], get: () => undefined,
    namespace: () => {}, update: () => {}, remove: () => {},
  }
  // This host fixture supplies exactly the context domains used by setupSourcefed.
  const ctx = {
    session, location: { directory, project: { id: projectID, directory, canonical: directory } },
    tool: { transform: async (register: (editor: Editor) => void) => {
      if (failRegistration) throw new Error("registration failed")
      register(editor)
      return { dispose: async () => {} }
    } },
  } as Context
  async function call(name: string, input: Record<string, unknown>) {
    const tool = tools.find((tool) => tool.name === name)
    assert.ok(tool?.execute)
    // OpenCode supplies the full tool context; these tools consume only sessionID.
    return tool.execute(input, { sessionID } as Parameters<NonNullable<Tool["execute"]>>[1])
  }
  return { ctx, tools, delivered, call }
}

test("real HTTP demand stays at 20 streams across 40 plugin instances and drains on unload", async () => {
  const daemon = new CountingDaemon({ store: new InMemoryMonitorStore(), eventQueue: new InMemoryMonitorEventQueue() })
  const server = await serveHttp({ hostname: "127.0.0.1", port: 0, handler: (request) => handleDaemonHttpRequest(daemon, request) })
  const previous = process.env.SOURCEFED_DAEMON_URL
  process.env.SOURCEFED_DAEMON_URL = `http://127.0.0.1:${server.port}`
  const cleanup: Array<() => Promise<void> | void> = []
  try {
    const fixtures = Array.from({ length: 20 }, (_, i) => context(`project_${i}`, `ses_${i}`))
    const monitors = await Promise.all(fixtures.map((_, i) => daemon.createMonitor(
      { kind: "opencode-session", id: `ses_${i}` }, { name: `test_${i}`, sourceType: "jira", issueKey: "TEST-1" },
    )))
    // Another project's target is accessible but has no owning plugin location.
    await daemon.createMonitor({ kind: "opencode-session", id: "ses_foreign" }, { name: "foreign", sourceType: "jira", issueKey: "TEST-1" })
    for (const fixture of [...fixtures, ...fixtures]) {
      const dispose = await setupSourcefed(fixture.ctx)
      assert.equal(typeof dispose, "function")
      if (dispose) cleanup.push(dispose)
    }
    assert.equal(daemon.active, 20)
    for (let i = 0; i < 3; i++) await Promise.all(fixtures.map((fixture) => fixture.call("monitor_list", {})))
    assert.equal(daemon.peak, 20)
    const first = monitors[0]
    assert.ok(first && "monitor" in first && first.monitor)
    const record = await daemon.service.get(first.monitor.id)
    assert.ok(record)
    await daemon.runtime.context.sink.deliver({ monitor: record, event: {
      source: record.source, kind: "comment", at: "2026-09-25T00:00:00Z", summary: "test event", actionable: false,
    } })
    await until(async () => fixtures[0].delivered.length === 1 && (await daemon.readEvents(record.target)).length === 0)
    assert.equal(fixtures.reduce((total, fixture) => total + fixture.delivered.length, 0), 1)
    await fixtures[0].call("monitor_stop", { id: first.monitor.id })
    await until(() => daemon.active === 19)
    await Promise.all(cleanup.splice(0).map((dispose) => dispose()))
    await until(() => daemon.active === 0)
    assert.equal(daemon.peak, 20)
  } finally {
    await Promise.all(cleanup.map((dispose) => dispose()))
    if (previous === undefined) delete process.env.SOURCEFED_DAEMON_URL
    else process.env.SOURCEFED_DAEMON_URL = previous
    await server.stop()
  }
})

test("failed tool registration releases real streams and a later setup can reconnect", async () => {
  const daemon = new CountingDaemon({ store: new InMemoryMonitorStore(), eventQueue: new InMemoryMonitorEventQueue() })
  await daemon.createMonitor({ kind: "opencode-session", id: "ses_failure" }, { name: "test", sourceType: "jira", issueKey: "TEST-1" })
  const server = await serveHttp({ hostname: "127.0.0.1", port: 0, handler: (request) => handleDaemonHttpRequest(daemon, request) })
  const previous = process.env.SOURCEFED_DAEMON_URL
  process.env.SOURCEFED_DAEMON_URL = `http://127.0.0.1:${server.port}`
  try {
    await assert.rejects(setupSourcefed(context("project_failure", "ses_failure", true).ctx), /registration failed/)
    await until(() => daemon.active === 0)
    const cleanup = await setupSourcefed(context("project_failure", "ses_failure").ctx)
    assert.equal(daemon.active, 1)
    await cleanup?.()
    await until(() => daemon.active === 0)
  } finally {
    if (previous === undefined) delete process.env.SOURCEFED_DAEMON_URL
    else process.env.SOURCEFED_DAEMON_URL = previous
    await server.stop()
  }
})
