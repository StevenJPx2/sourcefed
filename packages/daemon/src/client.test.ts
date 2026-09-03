import assert from "node:assert/strict"
import { afterEach, describe, test } from "node:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { InMemoryMonitorEventQueue, InMemoryMonitorStore, type QueuedMonitorEvent } from "@sourcefed/core"
import { serveHttp } from "@sourcefed/daemon"
import { connectDaemonClient } from "./client.ts"
import { daemonCommand, daemonEnvironment, spawnLocalDaemon } from "./utils"
import { SourcefedDaemon } from "./daemon.ts"
import { handleDaemonHttpRequest } from "./http.ts"

const CLI_ENTRY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../packages/cli/dist/index.js")
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("daemon clients", () => {
  test("auto-spawns a local HTTP daemon and drives it", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "sourcefed-spawn-"))
    temporaryDirectories.push(directory)
    const port = 19000 + Math.floor(Math.random() * 1000)
    const spawned = await spawnLocalDaemon({
      ...daemonCommand(CLI_ENTRY),
      env: { ...daemonEnvironment(), SOURCEFED_STATE_DIR: directory },
      port,
    })
    try {
      assert.equal(spawned.url, `http://127.0.0.1:${port}`)
      const client = await connectDaemonClient({ name: "sourcefed-test", url: spawned.url })

      const target = { kind: "test", id: "session-1" }
      const sourceTypes = await client.request("daemon.sourceTypes")
      assert.deepEqual(sourceTypes, { sourceTypes: ["jira", "github", "slack"] })

      const created = await client.request("monitor.create", {
        name: "ADEPT-1",
        sourceType: "jira",
        issueKey: "ADEPT-1",
        target,
      }) as { ok: boolean; created: boolean; monitor: { id: string; enabled: boolean } }
      assert.equal(created.ok, true)
      assert.equal(created.created, true)

      const listed = await client.request("monitor.list", { target }) as { monitors: Array<{ id: string }> }
      assert.equal(listed.monitors.length, 1)

      const foreign = await client.request("monitor.status", { target: { kind: "other", id: "session-2" }, id: created.monitor.id })
      assert.partialDeepStrictEqual(foreign, { ok: false })

      const stopped = await client.request("monitor.stop", { target, id: created.monitor.id }) as { monitor: { enabled: boolean } }
      assert.equal(stopped.monitor.enabled, false)

      await client.close()
    } finally {
      spawned.proc?.kill()
    }
  })

  test("http client receives pushed events and acknowledges them", async () => {
    const daemon = new SourcefedDaemon({
      store: new InMemoryMonitorStore(),
      eventQueue: new InMemoryMonitorEventQueue(),
    })
    const server = await serveHttp({
      hostname: "127.0.0.1",
      port: 0,
      handler: (request: Request) => handleDaemonHttpRequest(daemon, request),
    })
    try {
      const client = await connectDaemonClient({ name: "sourcefed-test", url: `http://127.0.0.1:${server.port}` })
      const target = { kind: "test", id: "session-1" }
      const created = await client.request("monitor.create", {
        name: "ADEPT-1",
        sourceType: "jira",
        issueKey: "ADEPT-1",
        target,
      }) as { monitor: { id: string } }

      const received: QueuedMonitorEvent[] = []
      const listener = await client.subscribe(target, async (events) => {
        received.push(...events)
      })

      const record = await daemon.service.get(created.monitor.id)
      if (!record) throw new Error("monitor record not found")
      await daemon.runtime.context.sink.deliver({
        monitor: record,
        event: {
          source: record.source,
          kind: "comment",
          id: "comment:1",
          at: "2026-08-04T12:00:00.000Z",
          summary: "Jira ADEPT-1 comment",
          actionable: true,
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 200))
      assert.equal(received.length, 1)
      assert.equal(received[0].event.summary, "Jira ADEPT-1 comment")

      const remaining = await client.request("monitor.events", { target }) as { events: QueuedMonitorEvent[] }
      assert.equal(remaining.events.length, 0)

      await listener.close()
      await client.close()
    } finally {
      await server.stop()
    }
  })

  test("three HTTP clients receive one notification for the same target", async () => {
    const daemon = new SourcefedDaemon({
      store: new InMemoryMonitorStore(),
      eventQueue: new InMemoryMonitorEventQueue(),
    })
    const server = await serveHttp({
      hostname: "127.0.0.1",
      port: 0,
      handler: (request: Request) => handleDaemonHttpRequest(daemon, request),
    })
    const clients = await Promise.all(Array.from({ length: 3 }, (_, index) => (
      connectDaemonClient({ name: `sourcefed-test-${index}`, url: `http://127.0.0.1:${server.port}` })
    )))
    const listeners: Array<{ close(): Promise<void> }> = []
    try {
      const target = { kind: "test", id: "session-1" }
      const created = await clients[0].request("monitor.create", {
        name: "ADEPT-1",
        sourceType: "jira",
        issueKey: "ADEPT-1",
        target,
      }) as { monitor: { id: string } }
      const received = [0, 0, 0]
      const record = await daemon.service.get(created.monitor.id)
      if (!record) throw new Error("monitor record not found")
      await daemon.runtime.context.sink.deliver({
        monitor: record,
        event: {
          source: record.source,
          kind: "comment",
          id: "comment:backlog",
          at: "2026-08-04T12:00:00.000Z",
          summary: "Jira ADEPT-1 backlog comment",
          actionable: true,
        },
      })
      listeners.push(...await Promise.all(clients.map((client, index) => (
        client.subscribe(target, async (events) => {
          received[index] += events.length
        })
      ))))
      await new Promise((resolve) => setTimeout(resolve, 200))
      assert.equal(received.reduce((total, count) => total + count, 0), 1)

      await daemon.runtime.context.sink.deliver({
        monitor: record,
        event: {
          source: record.source,
          kind: "comment",
          id: "comment:1",
          at: "2026-08-04T12:00:00.000Z",
          summary: "Jira ADEPT-1 comment",
          actionable: true,
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 200))
      assert.equal(received.reduce((total, count) => total + count, 0), 2)
    } finally {
      await Promise.all(listeners.map((listener) => listener.close()))
      await Promise.all(clients.map((client) => client.close()))
      await server.stop()
    }
  })

  test("retries acknowledgement without repeating the host callback", async () => {
    const daemon = new SourcefedDaemon({
      store: new InMemoryMonitorStore(),
      eventQueue: new InMemoryMonitorEventQueue(),
    })
    let acknowledgementAttempts = 0
    const server = await serveHttp({
      hostname: "127.0.0.1",
      port: 0,
      handler: async (request: Request) => {
        if (new URL(request.url).pathname === "/rpc" && request.method === "POST") {
          const body = await request.clone().json() as { method?: string }
          if (body.method === "monitor.ack" && acknowledgementAttempts++ < 2) {
            return Response.json({ error: "temporary acknowledgement failure" }, { status: 503 })
          }
        }
        return handleDaemonHttpRequest(daemon, request)
      },
    })
    const client = await connectDaemonClient({ name: "sourcefed-test", url: `http://127.0.0.1:${server.port}` })
    let deliveries = 0
    try {
      const target = { kind: "test", id: "session-1" }
      const created = await client.request("monitor.create", {
        name: "ADEPT-1",
        sourceType: "jira",
        issueKey: "ADEPT-1",
        target,
      }) as { monitor: { id: string } }
      const listener = await client.subscribe(target, async () => { deliveries += 1 })
      const record = await daemon.service.get(created.monitor.id)
      if (!record) throw new Error("monitor record not found")

      await daemon.runtime.context.sink.deliver({
        monitor: record,
        event: {
          source: record.source,
          kind: "comment",
          id: "comment:1",
          at: "2026-08-04T12:00:00.000Z",
          summary: "Jira ADEPT-1 comment",
          actionable: true,
        },
      })
      const deadline = Date.now() + 3_000
      while (acknowledgementAttempts < 3 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      assert.equal(deliveries, 1)
      assert.equal(acknowledgementAttempts, 3)
      assert.equal((await daemon.readEvents(target)).length, 0)
      await listener.close()
    } finally {
      await client.close()
      await server.stop()
    }
  })

  test("releases and retries an event when the host callback fails", async () => {
    const daemon = new SourcefedDaemon({
      store: new InMemoryMonitorStore(),
      eventQueue: new InMemoryMonitorEventQueue(),
    })
    const server = await serveHttp({
      hostname: "127.0.0.1",
      port: 0,
      handler: (request: Request) => handleDaemonHttpRequest(daemon, request),
    })
    const client = await connectDaemonClient({ name: "sourcefed-test", url: `http://127.0.0.1:${server.port}` })
    let deliveries = 0
    try {
      const target = { kind: "test", id: "session-1" }
      const created = await client.request("monitor.create", {
        name: "ADEPT-1",
        sourceType: "jira",
        issueKey: "ADEPT-1",
        target,
      }) as { monitor: { id: string } }
      const listener = await client.subscribe(target, async () => {
        deliveries += 1
        if (deliveries === 1) throw new Error("host temporarily unavailable")
      })
      const record = await daemon.service.get(created.monitor.id)
      if (!record) throw new Error("monitor record not found")

      await daemon.runtime.context.sink.deliver({
        monitor: record,
        event: {
          source: record.source,
          kind: "comment",
          id: "comment:1",
          at: "2026-08-04T12:00:00.000Z",
          summary: "Jira ADEPT-1 comment",
          actionable: true,
        },
      })
      const deadline = Date.now() + 3_000
      while ((deliveries < 2 || (await daemon.readEvents(target)).length > 0) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      assert.equal(deliveries, 2)
      assert.equal((await daemon.readEvents(target)).length, 0)
      await listener.close()
    } finally {
      await client.close()
      await server.stop()
    }
  })

  test("stop closes active SSE streams", async () => {
    const daemon = new SourcefedDaemon({
      store: new InMemoryMonitorStore(),
      eventQueue: new InMemoryMonitorEventQueue(),
    })
    const server = await serveHttp({
      hostname: "127.0.0.1",
      port: 0,
      handler: (request: Request) => handleDaemonHttpRequest(daemon, request),
    })

    const client = await connectDaemonClient({ name: "sourcefed-test", url: `http://127.0.0.1:${server.port}` })
    const listener = await client.subscribe({ kind: "test", id: "session-1" }, async () => {})

    await Promise.race([
      server.stop(),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error("server.stop hung on an open SSE stream")), 2_000)),
    ])

    await listener.close().catch(() => {})
    await client.close().catch(() => {})
  })

  test("rejects unauthenticated requests when a token is configured", async () => {
    const daemon = new SourcefedDaemon({
      store: new InMemoryMonitorStore(),
      eventQueue: new InMemoryMonitorEventQueue(),
    })
    const server = await serveHttp({
      hostname: "127.0.0.1",
      port: 0,
      handler: (request: Request) => handleDaemonHttpRequest(daemon, request, { token: "secret" }),
    })
    try {
      const anonymous = await connectDaemonClient({ name: "sourcefed-test", url: `http://127.0.0.1:${server.port}` })
      await assert.rejects(anonymous.request("daemon.sourceTypes"))
      await anonymous.close()

      const authenticated = await connectDaemonClient({
        name: "sourcefed-test",
        url: `http://127.0.0.1:${server.port}`,
        token: "secret",
      })
      const sourceTypes = await authenticated.request("daemon.sourceTypes")
      assert.deepEqual(sourceTypes, { sourceTypes: ["jira", "github", "slack"] })
      await authenticated.close()
    } finally {
      await server.stop()
    }
  })
})
