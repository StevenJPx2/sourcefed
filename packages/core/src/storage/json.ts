import { link, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import * as v from "valibot"
import { createQueuedMonitorEvent } from "../events.ts"
import { MonitorRegistrySchema } from "../monitors/schema.ts"
import type { MonitorRecord, MonitorRegistry } from "../monitors/types"
import type { MonitorEvent, MonitorEventQueue, MonitorStore, MonitorTarget, QueuedMonitorEvent } from "../types"

export type JsonMonitorStoreOptions = {
  stateDir?: string
}

export class JsonMonitorStore implements MonitorStore {
  readonly stateDir: string
  readonly stateFile: string

  constructor(options: JsonMonitorStoreOptions = {}) {
    this.stateDir = options.stateDir ?? process.env.SOURCEFED_STATE_DIR ?? path.join(process.env.XDG_STATE_HOME ?? path.join(os.homedir(), ".local", "state"), "sourcefed")
    this.stateFile = path.join(this.stateDir, "monitors.json")
  }

  async load(): Promise<MonitorRegistry> {
    const raw = await this.readRaw(this.stateFile)
    if (raw === undefined) return { monitors: [] }
    const parsed = parseRegistry(raw)
    if (!parsed) throw new Error(`invalid monitor state at ${this.stateFile}; refusing to overwrite`)
    return parsed
  }

  async acquireExclusive(): Promise<() => Promise<void>> {
    const lockPath = path.join(this.stateDir, ".monitors.lock")
    await mkdir(this.stateDir, { recursive: true })
    const pid = String(process.pid)
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const handle = await open(lockPath, "wx")
        await handle.writeFile(pid)
        let released = false
        return async () => {
          if (released) return
          released = true
          await handle.close()
          const current = await readLockPid(lockPath)
          if (current === process.pid) await rm(lockPath, { force: true })
        }
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : undefined
        if (code !== "EEXIST") throw error
        const holder = await readLockPid(lockPath)
        if (holder === undefined || processAlive(holder)) {
          throw new Error(`another sourcefed daemon (pid ${holder ?? "unknown"}) is using ${this.stateDir}; stop it or set SOURCEFED_STATE_DIR`)
        }
        const contender = `${lockPath}.${process.pid}.${Date.now().toString(36)}`
        try {
          await rename(lockPath, contender)
        } catch {
          continue
        }
        await writeFile(contender, pid)
        try {
          await link(contender, lockPath)
        } catch {
          await rm(contender, { force: true })
          continue
        }
        await rm(contender, { force: true })
        let released = false
        return async () => {
          if (released) return
          released = true
          const current = await readLockPid(lockPath)
          if (current === process.pid) await rm(lockPath, { force: true })
        }
      }
    }
    throw new Error(`could not acquire the sourcefed state lock at ${lockPath}`)
  }

  async save(registry: MonitorRegistry): Promise<void> {
    await mkdir(this.stateDir, { recursive: true, mode: 0o700 })
    const temporary = `${this.stateFile}.${process.pid}.tmp`
    await writeFile(temporary, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 })
    await rename(temporary, this.stateFile)
  }

  private async readRaw(filePath: string): Promise<unknown | undefined> {
    try {
      const contents = await readFile(filePath, "utf8")
      return JSON.parse(contents)
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT") return undefined
      throw error
    }
  }
}

async function readLockPid(lockPath: string): Promise<number | undefined> {
  try {
    const contents = await readFile(lockPath, "utf8")
    const pid = Number(contents.trim())
    return Number.isInteger(pid) && pid > 0 ? pid : undefined
  } catch {
    return undefined
  }
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "EPERM")
  }
}

function parseRegistry(value: unknown): MonitorRegistry | undefined {
  const result = v.safeParse(MonitorRegistrySchema, value)
  return result.success ? result.output : undefined
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

  async enqueue(input: { monitor: MonitorRecord; event: MonitorEvent }): Promise<QueuedMonitorEvent> {
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
      if (!Array.isArray(parsed)) throw new Error(`invalid event queue at ${this.eventsFile}`)
      return parsed as QueuedMonitorEvent[]
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT") return []
      throw error
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
