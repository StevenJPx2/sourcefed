import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import * as v from "valibot"
import { createQueuedMonitorEvent, MonitorRegistrySchema } from "@sourcefed/core"
import type { MonitorEventQueue, MonitorRecord, MonitorRegistry, MonitorStore, MonitorTarget, QueuedMonitorEvent } from "@sourcefed/core"

export type JsonMonitorStoreOptions = {
  stateDir?: string
  legacyStateFile?: string
}

type LegacyMonitorRecord = Omit<MonitorRecord, "target"> & { sessionID?: string; target?: MonitorRecord["target"] }

export class JsonMonitorStore implements MonitorStore {
  readonly stateDir: string
  readonly stateFile: string
  private readonly legacyStateFile?: string

  constructor(options: JsonMonitorStoreOptions = {}) {
    this.stateDir = options.stateDir ?? process.env.SOURCEFED_STATE_DIR ?? path.join(process.env.XDG_STATE_HOME ?? path.join(os.homedir(), ".local", "state"), "sourcefed")
    this.stateFile = path.join(this.stateDir, "monitors.json")
    this.legacyStateFile = options.legacyStateFile ?? process.env.SOURCEFED_LEGACY_STATE_FILE
  }

  async load(): Promise<MonitorRegistry> {
    const current = parseRegistry(await this.readRaw(this.stateFile))
    if (current) return current

    if (this.legacyStateFile) {
      const legacy = migrateRegistry(await this.readRaw(this.legacyStateFile))
      if (legacy) {
        const migrated = legacy
        await this.save(migrated)
        return migrated
      }
    }

    return { monitors: [] }
  }

  async save(registry: MonitorRegistry): Promise<void> {
    await mkdir(this.stateDir, { recursive: true, mode: 0o700 })
    const temporary = `${this.stateFile}.${process.pid}.tmp`
    await writeFile(temporary, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 })
    await rename(temporary, this.stateFile)
  }

  private async readRaw(filePath: string): Promise<unknown> {
    try {
      const contents = await readFile(filePath, "utf8")
      return JSON.parse(contents)
    } catch {
      return undefined
    }
  }
}

function parseRegistry(value: unknown): MonitorRegistry | undefined {
  const result = v.safeParse(MonitorRegistrySchema, value)
  return result.success ? result.output : undefined
}

function migrateRegistry(value: unknown): MonitorRegistry | undefined {
  if (!value || typeof value !== "object" || !Array.isArray((value as { monitors?: unknown }).monitors)) return undefined
  return {
    monitors: (value as { monitors: unknown[] }).monitors.flatMap((monitor) => {
      if (!monitor || typeof monitor !== "object") return []
      const legacy = monitor as LegacyMonitorRecord
      if (!legacy.target && typeof legacy.sessionID !== "string") return []
      const { sessionID: _sessionID, ...withoutLegacyTarget } = legacy
      return {
        ...withoutLegacyTarget,
        target: legacy.target ?? { kind: "opencode-session", id: legacy.sessionID ?? "unknown" },
      }
    }),
  }
}

export function defaultJsonMonitorStore(options: JsonMonitorStoreOptions = {}): JsonMonitorStore {
  return new JsonMonitorStore(options)
}

export class JsonMonitorEventQueue implements MonitorEventQueue {
  readonly eventsFile: string
  private queue = Promise.resolve()

  constructor(readonly stateDir: string) {
    this.eventsFile = path.join(stateDir, "events.json")
  }

  async enqueue(input: { monitor: MonitorRecord; event: import("@sourcefed/core").MonitorEvent }): Promise<QueuedMonitorEvent> {
    return this.transact((events) => {
      const queued = createQueuedMonitorEvent(input.monitor, input.event)
      const existing = events.find((event) => event.id === queued.id)
      if (existing) return existing
      events.push(queued)
      return queued
    })
  }

  async read(target: MonitorTarget): Promise<QueuedMonitorEvent[]> {
    const events = await this.loadEvents()
    return events.filter((event) => sameTarget(event.target, target))
  }

  async acknowledge(target: MonitorTarget, eventIDs: string[]): Promise<void> {
    await this.transact((events) => {
      const ids = new Set(eventIDs)
      for (let index = events.length - 1; index >= 0; index -= 1) {
        if (sameTarget(events[index].target, target) && ids.has(events[index].id)) events.splice(index, 1)
      }
    })
  }

  private async transact<T>(operation: (events: QueuedMonitorEvent[]) => T | Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      const events = await this.loadEvents()
      const result = await operation(events)
      await this.saveEvents(events)
      return result
    })
    this.queue = next.then(() => undefined, () => undefined)
    return next
  }

  private async loadEvents(): Promise<QueuedMonitorEvent[]> {
    try {
      const contents = await readFile(this.eventsFile, "utf8")
      const parsed: unknown = JSON.parse(contents)
      return Array.isArray(parsed) ? parsed as QueuedMonitorEvent[] : []
    } catch {
      return []
    }
  }

  private async saveEvents(events: QueuedMonitorEvent[]): Promise<void> {
    await mkdir(this.stateDir, { recursive: true, mode: 0o700 })
    const temporary = `${this.eventsFile}.${process.pid}.tmp`
    await writeFile(temporary, `${JSON.stringify(events, null, 2)}\n`, { mode: 0o600 })
    await rename(temporary, this.eventsFile)
  }
}

function sameTarget(left: MonitorTarget, right: MonitorTarget): boolean {
  return left.kind === right.kind && left.id === right.id
}
