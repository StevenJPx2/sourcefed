import assert from "node:assert/strict"
import { test } from "node:test"
import type { MonitorView } from "@sourcefed/daemon"
import { MonitorManager, type MonitorAction, type MonitorManagerDeps } from "./monitors-dialog.ts"

const KEYS: Record<string, string> = {
  "tui.select.up": "UP",
  "tui.select.down": "DOWN",
  "tui.select.confirm": "ENTER",
  "tui.select.cancel": "ESC",
}

function monitor(id: string, enabled = true): MonitorView {
  return {
    id, name: id, enabled, describe: `watch ${id}`, icon: "*", label: id, detail: "", unresponsive: false,
    source: { type: "github" }, target: { kind: "pi-session", id: "s" }, delivery: "poll", pollIntervalSec: 60,
    createdAt: "2026-11-10T00:00:00Z", updatedAt: "2026-11-10T00:00:00Z",
  } as MonitorView
}

function harness(initial: MonitorView[], fail?: string) {
  let monitors = initial
  const calls: Array<[MonitorAction, string]> = []
  let closed = false
  let release: (() => void) | undefined
  const deps: MonitorManagerDeps = {
    theme: { fg: (_color, text) => text, bold: (text) => text },
    keys: { matches: (data, keybinding) => KEYS[keybinding] === data },
    requestRender: () => {},
    close: () => { closed = true },
    run: async (action, id) => {
      calls.push([action, id])
      await new Promise<void>((resolve) => { release = resolve })
      if (fail) throw new Error(fail)
      monitors = action === "remove"
        ? monitors.filter((candidate) => candidate.id !== id)
        : monitors.map((candidate) => candidate.id === id ? { ...candidate, enabled: action === "start" } : candidate)
      return monitors
    },
  }
  const manager = new MonitorManager(initial, deps)
  return {
    manager,
    calls,
    closed: () => closed,
    text: () => manager.render(200).join("\n"),
    settle: async () => { release?.(); await new Promise((resolve) => setImmediate(resolve)) },
  }
}

test("s stops a running monitor and starts a stopped one", async () => {
  const h = harness([monitor("a"), monitor("b", false)])
  h.manager.handleInput("s")
  assert.match(h.text(), /Stopping a…/)
  await h.settle()
  assert.match(h.text(), /› ● \* watch a \[stopped\]/)
  h.manager.handleInput("DOWN")
  h.manager.handleInput("s")
  await h.settle()
  assert.deepEqual(h.calls, [["stop", "a"], ["start", "b"]])
  assert.match(h.text(), /Sourcefed monitors \(1 active\)/)
})

test("d deletes only after y, then selects the next monitor", async () => {
  const h = harness([monitor("a"), monitor("b")])
  h.manager.handleInput("d")
  assert.match(h.text(), /Delete a\? .* y\/n/)
  h.manager.handleInput("n")
  assert.deepEqual(h.calls, [])
  h.manager.handleInput("d")
  h.manager.handleInput("y")
  await h.settle()
  assert.deepEqual(h.calls, [["remove", "a"]])
  assert.doesNotMatch(h.text(), /watch a/)
  assert.match(h.text(), /› ● \* watch b \[healthy\]/)
})

test("a failed action is shown, and keys wait while it runs", async () => {
  const h = harness([monitor("a")], "daemon unavailable")
  h.manager.handleInput("s")
  h.manager.handleInput("s")
  h.manager.handleInput("ESC")
  assert.equal(h.closed(), false)
  await h.settle()
  assert.deepEqual(h.calls, [["stop", "a"]])
  assert.match(h.text(), /daemon unavailable/)
  assert.match(h.text(), /\[healthy\]/)
  h.manager.handleInput("ESC")
  assert.equal(h.closed(), true)
})

test("an empty list says so and ignores actions", () => {
  const h = harness([])
  h.manager.handleInput("s")
  h.manager.handleInput("d")
  assert.deepEqual(h.calls, [])
  assert.match(h.text(), /No monitors/)
})
