import assert from "node:assert/strict"
import { describe, test } from "node:test"
import type { MonitorEvent, MonitorEventSink, MonitorRecord } from "@sourcefed/core"
import { GatedEventSink, type GatedEvent } from "./utils/gate.ts"

const monitor = {
  id: "mon_1",
  name: "PR 42",
  source: { type: "github", repo: "owner/repo", prNumber: 42 },
  delivery: "poll",
  target: { kind: "opencode-session", id: "ses_1" },
  pollIntervalSec: 60,
  enabled: true,
  createdAt: "2026-09-23T00:00:00.000Z",
  updatedAt: "2026-09-23T00:00:00.000Z",
  cursors: {},
} as unknown as MonitorRecord

const event: MonitorEvent = {
  source: monitor.source,
  kind: "comment",
  id: "c:1",
  at: "2026-09-23T10:00:00.000Z",
  summary: "codecov-bot commented on #42",
  body: "x".repeat(5_000),
  actionable: true,
}

function recordingSink(): { delivered: MonitorEvent[]; sink: MonitorEventSink } {
  const delivered: MonitorEvent[] = []

  return { delivered, sink: { deliver: async (input) => (delivered.push(input.event), { ok: true }) } }
}

function gateReplying(reply: () => Response | Promise<Response>): { bodies: GatedEvent[]; headers: Array<Record<string, string>>; fetch: typeof fetch } {
  const bodies: GatedEvent[] = []
  const headers: Array<Record<string, string>> = []

  return {
    bodies,
    headers,
    fetch: (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)) as GatedEvent)
      headers.push(init.headers as Record<string, string>)
      return reply()
    }) as unknown as typeof fetch,
  }
}

describe("GatedEventSink", () => {
  test("withholds an event only when the gate says deliver: false", async () => {
    const inner = recordingSink()
    const gate = gateReplying(() => Response.json({ deliver: false }))
    const sink = new GatedEventSink(inner.sink, { url: "http://127.0.0.1:18790/integrations/sourcefed", token: "t", fetch: gate.fetch })

    assert.deepEqual(await sink.deliver({ monitor, event }), { ok: true })
    assert.equal(inner.delivered.length, 0)
    assert.deepEqual(gate.bodies[0].target, { kind: "opencode-session", id: "ses_1" })
    assert.deepEqual(gate.bodies[0].source, { type: "github", repo: "owner/repo", prNumber: 42 })
    assert.equal(gate.bodies[0].event.body?.length, 1_000)
    assert.equal(gate.headers[0].authorization, "Bearer t")
  })

  test("delivers when the gate approves, fails, or answers unclearly", async () => {
    const replies = [
      () => Response.json({ deliver: true }),
      () => new Response("boom", { status: 500 }),
      () => Response.json({ something: "else" }),
      () => Promise.reject(new Error("connection refused")),
    ]

    for (const reply of replies) {
      const inner = recordingSink()
      const sink = new GatedEventSink(inner.sink, { url: "http://127.0.0.1:1/x", fetch: gateReplying(reply).fetch })

      assert.deepEqual(await sink.deliver({ monitor, event }), { ok: true })
      assert.equal(inner.delivered.length, 1)
    }
  })
})
