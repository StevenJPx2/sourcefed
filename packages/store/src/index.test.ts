import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { MonitorRecord } from "@sourcefed/core"
import { JsonMonitorEventQueue, JsonMonitorStore } from "./index.ts"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("JSON store", () => {
  test("migrates the old session target shape", async () => {
    const directory = await temporaryDirectory()
    const legacyFile = path.join(directory, "legacy.json")
    await writeFile(legacyFile, JSON.stringify({
      monitors: [{
        id: "m-old",
        name: "ADEPT-43742",
        source: { type: "jira", issueKey: "ADEPT-43742" },
        delivery: "poll",
        sessionID: "session-1",
        pollIntervalSec: 60,
        enabled: true,
        createdAt: "2026-08-04T12:00:00.000Z",
        updatedAt: "2026-08-04T12:00:00.000Z",
        cursors: {},
      }],
    }))

    const store = new JsonMonitorStore({ stateDir: path.join(directory, "new"), legacyStateFile: legacyFile })
    const registry = await store.load()
    expect(registry.monitors[0].target).toEqual({ kind: "opencode-session", id: "session-1" })
  })

  test("deduplicates and acknowledges queued events", async () => {
    const directory = await temporaryDirectory()
    const queue = new JsonMonitorEventQueue(directory)
    const monitor = {
      id: "m-1",
      name: "ADEPT-43742",
      source: { type: "jira" as const, issueKey: "ADEPT-43742" },
      delivery: "poll" as const,
      target: { kind: "test", id: "session-1" },
      pollIntervalSec: 60,
      enabled: true,
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
      cursors: {},
    } satisfies MonitorRecord
    const event = {
      source: monitor.source,
      kind: "comment",
      id: "comment:1",
      at: "2026-08-04T12:01:00.000Z",
      summary: "comment",
      actionable: true,
    }

    const first = await queue.enqueue({ monitor, event })
    const second = await queue.enqueue({ monitor, event })
    expect(second.id).toBe(first.id)
    expect(await queue.read(monitor.target)).toHaveLength(1)
    await queue.acknowledge(monitor.target, [first.id])
    expect(await queue.read(monitor.target)).toHaveLength(0)
  })
})

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sourcefed-store-"))
  temporaryDirectories.push(directory)
  return directory
}
