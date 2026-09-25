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

test("an explicit deliver: false withholds the event", async () => {
  const { instance, delivered, route } = bridge(false)

  await route(instance)

  assert.equal(delivered.length, 0)
})
