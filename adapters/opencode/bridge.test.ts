import assert from "node:assert/strict"
import { test } from "node:test"
import type { QueuedMonitorEvent } from "@sourcefed/core"
import type { DaemonClient } from "@sourcefed/daemon"
import { OpenCodeBridge } from "./bridge.ts"
import { OpenCodeSubscriptions } from "./subscriptions.ts"
import monitorList from "./tools/monitor_list.ts"

type Bridge = ConstructorParameters<typeof OpenCodeBridge>
type Delivered = { sessionID: string; metadata?: unknown }
const location = { directory: "/test/alpha", project: { id: "project_alpha" } }
const queued: QueuedMonitorEvent = {
  id: "evt_1", monitorID: "mon_42", target: { kind: "opencode-session", id: "ses_live" },
  event: { source: { type: "github" }, kind: "ci", at: "2026-09-25T00:00:00Z", summary: "CI failed", actionable: true },
} as QueuedMonitorEvent

function harness() {
  const targets = new Set(["ses_live"])
  const sessions = new Map([["ses_live", { projectID: location.project.id, location: { directory: location.directory } }]])
  const callbacks = new Map<string, (events: QueuedMonitorEvent[]) => Promise<void>>()
  const subscribed: string[] = []
  const closed: string[] = []
  const requests: string[] = []
  let connections = 0
  let disconnects = 0
  const daemon: DaemonClient = {
    request: async (method) => {
      requests.push(method)
      return method === "monitor.targets"
        ? { targets: [...targets].map((id) => ({ kind: "opencode-session", id })) }
        : { ok: true, monitors: [] }
    },
    subscribe: async (target) => {
      subscribed.push(target.id)
      return { close: async () => { closed.push(target.id); callbacks.delete(target.id) } }
    },
    close: async () => { disconnects += 1 },
  }
  const originalSubscribe = daemon.subscribe
  daemon.subscribe = async (target, callback, options) => {
    callbacks.set(target.id, callback)
    return originalSubscribe(target, callback, options)
  }
  const hub = new OpenCodeSubscriptions(async () => { connections += 1; return daemon })
  function instance(at = location, deliver = true) {
    const delivered: Delivered[] = []
    const gated: Array<Record<string, unknown>> = []
    const session: Bridge[0] = {
      get: async ({ sessionID }) => {
        const info = sessions.get(sessionID)
        if (!info) throw { _tag: "SessionNotFoundError", sessionID, message: "session not found" }
        return { ...info, id: sessionID, cost: 0, time: { created: 0, updated: 0 },
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } }
      },
      synthetic: async (message) => {
        delivered.push(message)
        return { id: "msg_test", sessionID: message.sessionID, time: { created: 0 }, type: "synthetic", payload: { text: message.text }, delivery: "steer" }
      },
    }
    const rpc: Bridge[1] = () => ({
      gate: async (args) => {
        assert.ok(args && typeof args === "object")
        gated.push({ ...args })
        return { deliver }
      },
    })
    const bridge = new OpenCodeBridge(session, rpc, at, hub)
    return { bridge, delivered, gated }
  }
  return { hub, daemon, instance, targets, sessions, callbacks, subscribed, closed, requests,
    connections: () => connections, disconnects: () => disconnects }
}

test("the gate learns which monitor produced the event and can withhold it", async () => {
  const h = harness()
  const admitted = h.instance()
  await admitted.bridge.routeEvents([queued])
  assert.deepEqual(admitted.gated, [{ sessionID: "ses_live", monitorID: "mon_42", source: "github", kind: "ci", summary: "CI failed", body: "", actionable: true }])
  assert.equal(admitted.delivered.length, 1)
  const withheld = h.instance(location, false)
  await withheld.bridge.routeEvents([queued])
  assert.equal(withheld.delivered.length, 0)
})

test("multiple projects and duplicate plugin instances share one stream per owned session", async () => {
  const h = harness()
  const other = { directory: "/test/beta", project: { id: "project_beta" } }
  h.targets.add("ses_other")
  h.targets.add("ses_foreign")
  h.targets.add("ses_deleted")
  h.sessions.set("ses_other", { projectID: other.project.id, location: other })
  h.sessions.set("ses_foreign", { projectID: "project_foreign", location: { directory: "/test/foreign" } })
  const a = h.instance()
  const duplicate = h.instance()
  const b = h.instance(other)
  try {
    await Promise.all([a.bridge.start(), duplicate.bridge.start(), b.bridge.start()])
    await Promise.all(Array.from({ length: 25 }, () => a.bridge.refresh()))
    assert.equal(h.connections(), 1)
    assert.deepEqual(h.subscribed, ["ses_live", "ses_other"])
    await h.callbacks.get("ses_live")!([queued])
    await h.callbacks.get("ses_other")!([{ ...queued, target: { ...queued.target, id: "ses_other" } }])
    assert.equal(a.delivered.length, 1)
    assert.equal(duplicate.delivered.length, 0)
    assert.equal(b.delivered.length, 1)
    await a.bridge.close()
    assert.deepEqual(h.closed, [])
    await h.callbacks.get("ses_live")!([queued])
    assert.equal(duplicate.delivered.length, 1)
    await duplicate.bridge.close()
    assert.deepEqual(h.closed, ["ses_live"])
    assert.equal(h.disconnects(), 0)
  } finally {
    await Promise.all([a.bridge.close(), duplicate.bridge.close(), b.bridge.close()])
  }
  assert.equal(h.disconnects(), 1)
})

test("worktree routing prefers the exact location and follows session moves", async () => {
  const h = harness()
  const worktree = { ...location, directory: "/test/alpha-worktree" }
  const root = h.instance()
  const branch = h.instance(worktree)
  try {
    await Promise.all([root.bridge.start(), branch.bridge.start()])
    h.sessions.set("ses_live", { projectID: location.project.id, location: worktree })
    // Delivery must follow the new location even before the next timer refresh.
    await h.callbacks.get("ses_live")!([queued])
    assert.equal(root.delivered.length, 0)
    assert.equal(branch.delivered.length, 1)
    await branch.bridge.close()
    await h.callbacks.get("ses_live")!([queued])
    assert.equal(root.delivered.length, 1)
    assert.equal(h.subscribed.length, 1)
  } finally { await Promise.all([root.bridge.close(), branch.bridge.close()]) }
})

test("refresh removes stopped/deleted monitors and deleted sessions; external monitors are discovered", async () => {
  const h = harness()
  const { bridge } = h.instance()
  try {
    await bridge.start()
    h.targets.clear()
    await bridge.refresh()
    assert.deepEqual(h.closed, ["ses_live"])
    h.targets.add("ses_live") // CLI or Chauffeur re-enables it.
    await bridge.refresh()
    assert.equal(h.subscribed.length, 2)
    h.sessions.delete("ses_live")
    await bridge.refresh()
    assert.deepEqual(h.closed, ["ses_live", "ses_live"])
    await bridge.refresh()
    assert.equal(h.subscribed.length, 2)
  } finally { await bridge.close() }
})

test("repeated list/status/stop calls on unmonitored sessions never subscribe", async () => {
  const h = harness()
  h.targets.clear()
  const { bridge } = h.instance()
  try {
    await bridge.start()
    for (let i = 0; i < 10; i++) {
      for (const name of ["monitor_list", "monitor_status", "monitor_stop"]) {
        await bridge.callTool(name, {}, "ses_unmonitored")
      }
    }
    assert.deepEqual(h.subscribed, [])
    assert.equal(h.connections(), 1)
  } finally { await bridge.close() }
})

test("tool mutations reconcile only after the daemon changes demand", async () => {
  const h = harness()
  h.targets.clear()
  const request = h.daemon.request
  h.daemon.request = async (method, params) => {
    if (method === "monitor.create" || method === "monitor.start") h.targets.add("ses_live")
    if (method === "monitor.stop") h.targets.delete("ses_live")
    return request(method, params)
  }
  const { bridge } = h.instance()
  try {
    await bridge.callTool("monitor_create", {}, "ses_live")
    assert.deepEqual(h.subscribed, ["ses_live"])
    await bridge.callTool("monitor_stop", {}, "ses_live")
    assert.deepEqual(h.closed, ["ses_live"])
    await bridge.callTool("monitor_start", {}, "ses_live")
    assert.equal(h.subscribed.length, 2)
  } finally { await bridge.close() }
})

test("unload cancels concurrent subscription setup without resurrecting a listener", async () => {
  const h = harness()
  const entered = Promise.withResolvers<void>()
  h.daemon.subscribe = async (_target, _callback, options) => {
    entered.resolve()
    await new Promise<void>((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("cancelled")), { once: true })
    })
    throw new Error("unreachable")
  }
  const { bridge } = h.instance()
  const starting = bridge.start()
  await entered.promise
  await bridge.close()
  await starting
  await bridge.refresh()
  assert.equal(h.disconnects(), 1)
  assert.deepEqual(await bridge.callTool("monitor_list", {}, "ses_live"), { ok: false, error: "Error: sourcefed bridge is closed" })
})

test("unload during connect closes the late client and never subscribes", async () => {
  const h = harness()
  const connection = Promise.withResolvers<DaemonClient>()
  const hub = new OpenCodeSubscriptions(() => connection.promise)
  const owner = h.instance().bridge
  const starting = hub.add(owner)
  const closing = hub.remove(owner)
  connection.resolve(h.daemon)
  await Promise.all([starting, closing])
  assert.equal(h.disconnects(), 1)
  assert.deepEqual(h.subscribed, [])
})

test("failed subscription setup is retried on refresh without duplicate listeners", async () => {
  const h = harness()
  const subscribe = h.daemon.subscribe
  let attempts = 0
  h.daemon.subscribe = async (...args) => {
    if (++attempts === 1) throw new Error("temporary setup failure")
    return subscribe(...args)
  }
  const { bridge } = h.instance()
  try {
    await bridge.start()
    await Promise.all([bridge.refresh(), bridge.refresh()])
    assert.equal(attempts, 2)
    assert.deepEqual(h.subscribed, ["ses_live"])
  } finally { await bridge.close() }
})

test("a failed target inventory preserves existing streams", async () => {
  const h = harness()
  const { bridge } = h.instance()
  try {
    await bridge.start()
    h.daemon.request = async () => { throw new Error("daemon restarting") }
    await bridge.refresh()
    assert.deepEqual(h.closed, [])
  } finally { await bridge.close() }
})

test("temporary session lookup failures preserve an existing stream", async () => {
  const h = harness()
  const { bridge } = h.instance()
  try {
    await bridge.start()
    bridge.getSession = async () => { throw new Error("temporary OpenCode transport failure") }
    await bridge.refresh()
    assert.deepEqual(h.closed, [])
    assert.deepEqual(h.subscribed, ["ses_live"])
  } finally { await bridge.close() }
})

test("unload during refresh lookup cannot recreate a subscription", async () => {
  const h = harness()
  const { bridge } = h.instance()
  await bridge.start()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const getSession = bridge.getSession.bind(bridge)
  bridge.getSession = async (id, signal) => {
    entered.resolve()
    await release.promise
    return getSession(id, signal)
  }
  const refreshing = bridge.refresh()
  await entered.promise
  const closing = bridge.close()
  assert.equal(bridge.close(), closing, "concurrent unloads share the same cleanup")
  release.resolve()
  await Promise.all([closing, refreshing])
  assert.deepEqual(h.subscribed, ["ses_live"])
  assert.deepEqual(h.closed, ["ses_live"])
  assert.equal(h.disconnects(), 1)
})

test("periodic refresh recovers a failed daemon connection and discovers external demand", { timeout: 20_000 }, async () => {
  const h = harness()
  let attempts = 0
  const hub = new OpenCodeSubscriptions(async () => {
    if (++attempts === 1) throw new Error("temporary daemon startup failure")
    return h.daemon
  })
  const owner = h.instance().bridge
  try {
    await hub.add(owner)
    await hub.refresh()
    assert.equal(attempts, 1, "failed connections are throttled")
    const deadline = Date.now() + 17_000
    while (h.subscribed.length === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25))
    assert.deepEqual(h.subscribed, ["ses_live"])
    assert.equal(attempts, 2)
  } finally { await hub.remove(owner) }
})

test("tools retain their own bridge instead of using the last loaded instance", async () => {
  const a = harness()
  const b = harness()
  a.targets.clear()
  b.targets.clear()
  const first = a.instance().bridge
  const second = b.instance().bridge
  try {
    await Promise.all([first.start(), second.start()])
    // The tool's executor only needs sessionID; the host supplies the other context fields.
    await monitorList(first).execute({}, { sessionID: "ses_live" } as Parameters<ReturnType<typeof monitorList>["execute"]>[1])
    assert.equal(a.requests.filter((name) => name === "monitor.list").length, 1)
    assert.equal(b.requests.filter((name) => name === "monitor.list").length, 0)
  } finally { await Promise.all([first.close(), second.close()]) }
})
