import assert from "node:assert/strict"
import { afterEach, describe, test } from "node:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { MonitorRecord } from "@sourcefed/core"
import { JsonMonitorEventQueue, JsonMonitorStore } from "./json.ts"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("JSON store", () => {
  test("persists monitors across store instances", async () => {
    const directory = await temporaryDirectory()
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

    const store = new JsonMonitorStore({ stateDir: directory })
    await store.save({ monitors: [monitor] })

    const reloaded = await new JsonMonitorStore({ stateDir: directory }).load()
    assert.deepEqual(reloaded.monitors, [monitor])
  })

  test("refuses to overwrite malformed monitor state", async () => {
    const directory = await temporaryDirectory()
    await writeFile(path.join(directory, "monitors.json"), "{ not json")

    const store = new JsonMonitorStore({ stateDir: directory })
    await assert.rejects(store.load())
  })

  test("serializes exclusive daemon ownership of the state directory", async () => {
    const directory = await temporaryDirectory()
    const first = new JsonMonitorStore({ stateDir: directory })
    const release = await first.acquireExclusive()

    const second = new JsonMonitorStore({ stateDir: directory })
    await assert.rejects(second.acquireExclusive(), /another sourcefed daemon/)

    await release()
    const retake = await second.acquireExclusive()
    await retake()
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
    assert.equal(second.id, first.id)
    assert.equal((await queue.read(monitor.target)).length, 1)
    await queue.acknowledge(monitor.target, [first.id])
    assert.equal((await queue.read(monitor.target)).length, 0)
  })
})

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sourcefed-store-"))
  temporaryDirectories.push(directory)
  return directory
}
