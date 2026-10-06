import assert from "node:assert/strict"
import { test } from "node:test"
import type { QueuedMonitorEvent } from "@sourcefed/core"
import { OpenCodeBridge } from "./bridge.ts"

type Bridge = ConstructorParameters<typeof OpenCodeBridge>
type Delivered = { sessionID: string; metadata: unknown }

const queued: QueuedMonitorEvent = {
  id: "evt_1",
  monitorID: "mon_42",
  target: { kind: "opencode-session", id: "ses_1" },
  event: { source: { type: "github" }, kind: "ci", at: "2026-09-25T00:00:00Z", summary: "CI failed", actionable: true },
} as QueuedMonitorEvent

function bridge(deliver: boolean) {
  const gated: Array<Record<string, unknown>> = []
  const delivered: Delivered[] = []
  const session = { synthetic: async (message: Delivered) => { delivered.push(message) } } as unknown as Bridge[0]
  const rpc = (() => ({ gate: async (args: Record<string, unknown>) => { gated.push(args); return { deliver } } })) as unknown as Bridge[1]
  const route = (instance: OpenCodeBridge) =>
    (instance as unknown as { routeEvents(events: QueuedMonitorEvent[]): Promise<void> }).routeEvents([queued])

  return { instance: new OpenCodeBridge(session, rpc), gated, delivered, route }
}

test("the gate learns which monitor produced the event", async () => {
  const { instance, gated, delivered, route } = bridge(true)

  await route(instance)

  assert.deepEqual(gated, [{ sessionID: "ses_1", monitorID: "mon_42", source: "github", kind: "ci", summary: "CI failed", body: "", actionable: true }])
  assert.equal(delivered.length, 1)
})

test("after a restart it resubscribes the sessions that still exist", async () => {
  const subscribed: string[] = []
  const session = {
    get: async ({ sessionID }: { sessionID: string }) => {
      if (sessionID === "ses_deleted") throw new Error("session not found")
      return { id: sessionID }
    },
  } as unknown as Bridge[0]
  const daemon = {
    request: async (method: string, params: { kind: string }) => {
      assert.deepEqual([method, params], ["monitor.targets", { kind: "opencode-session" }])
      return { targets: [{ kind: "opencode-session", id: "ses_live" }, { kind: "opencode-session", id: "ses_deleted" }] }
    },
    subscribe: async (target: { id: string }) => {
      subscribed.push(target.id)
      return { close: async () => {} }
    },
  }
  const instance = new OpenCodeBridge(session)
  const internals = instance as unknown as { daemon: typeof daemon; resubscribe(): Promise<void> }
  internals.daemon = daemon

  await internals.resubscribe()
  await instance.ensureTarget("ses_live")

  assert.deepEqual(subscribed, ["ses_live"])
})

test("a monitor another client creates later is picked up once on refresh", async () => {
  const subscribed: string[] = []
  const targets = [{ kind: "opencode-session", id: "ses_old" }]
  const session = { get: async ({ sessionID }: { sessionID: string }) => ({ id: sessionID }) } as unknown as Bridge[0]
  const daemon = {
    request: async () => ({ targets }),
    subscribe: async (target: { id: string }) => {
      subscribed.push(target.id)
      return { close: async () => {} }
    },
  }
  const instance = new OpenCodeBridge(session)
  const internals = instance as unknown as { daemon: typeof daemon; refresh(): Promise<void> }
  internals.daemon = daemon

  await internals.refresh()
  // Chauffeur creates a monitor for another session after startup.
  targets.push({ kind: "opencode-session", id: "ses_new" })
  await internals.refresh()
  await internals.refresh()

  assert.deepEqual(subscribed, ["ses_old", "ses_new"])
})

test("an explicit deliver: false withholds the event", async () => {
  const { instance, delivered, route } = bridge(false)

  await route(instance)

  assert.equal(delivered.length, 0)
})
