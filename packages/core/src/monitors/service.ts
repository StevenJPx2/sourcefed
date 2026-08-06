import type { MonitorSource } from "#sourcefed/sources"
import type { MonitorStore, MonitorTarget } from "#sourcefed/types"
import type { MonitorRecord } from "./types"
import { dedupeActiveMonitors, monitorIdentity } from "./utils/monitor-identity.ts"

export type CreateMonitorInput = {
  name: string
  source: MonitorSource
  delivery: "poll" | "webhook"
  target: MonitorTarget
  pollIntervalSec: number
}

export type CreateMonitorResult = {
  monitor: MonitorRecord
  created: boolean
}

export class MonitorService {
  private registryQueue = Promise.resolve()

  constructor(readonly store: MonitorStore) {}

  async list(): Promise<MonitorRecord[]> {
    return (await this.store.load()).monitors
  }

  async get(id: string): Promise<MonitorRecord | undefined> {
    return (await this.store.load()).monitors.find((monitor) => monitor.id === id)
  }

  async create(input: CreateMonitorInput): Promise<CreateMonitorResult> {
    return this.transact((registry) => {
      registry.monitors = dedupeActiveMonitors(registry.monitors)
      const identity = monitorIdentity(input.target, input.source)
      const existing = registry.monitors.find(
        (monitor) => monitor.enabled && monitorIdentity(monitor.target, monitor.source) === identity,
      )
      if (existing) return { monitor: existing, created: false }

      const now = new Date().toISOString()
      const monitor: MonitorRecord = {
        id: `m-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`,
        name: input.name,
        source: input.source,
        delivery: input.delivery,
        target: input.target,
        pollIntervalSec: Math.max(15, input.pollIntervalSec ?? 60),
        enabled: true,
        createdAt: now,
        updatedAt: now,
        cursors: {},
      }
      registry.monitors.push(monitor)
      return { monitor, created: true }
    })
  }

  async stop(id: string): Promise<MonitorRecord | { error: string }> {
    return this.transact((registry) => {
      const monitor = registry.monitors.find((entry) => entry.id === id)
      if (!monitor) return { error: `monitor ${id} was not found` }
      monitor.enabled = false
      monitor.updatedAt = new Date().toISOString()
      return monitor
    })
  }

  async start(id: string): Promise<MonitorRecord | { error: string }> {
    return this.transact((registry) => {
      const monitor = registry.monitors.find((entry) => entry.id === id)
      if (!monitor) return { error: `monitor ${id} was not found` }
      const identity = monitorIdentity(monitor.target, monitor.source)
      const duplicate = registry.monitors.find(
        (entry) => entry.id !== id && entry.enabled && monitorIdentity(entry.target, entry.source) === identity,
      )
      if (duplicate) return { error: `monitor ${id} duplicates active monitor ${duplicate.id} for the same source` }
      monitor.enabled = true
      monitor.updatedAt = new Date().toISOString()
      return monitor
    })
  }

  async remove(id: string): Promise<void> {
    await this.transact((registry) => {
      registry.monitors = registry.monitors.filter((monitor) => monitor.id !== id)
    })
  }

  async setDelivery(id: string, delivery: "poll" | "webhook"): Promise<void> {
    await this.updateMonitor(id, (monitor) => { monitor.delivery = delivery })
  }

  async updateCursor(monitor: MonitorRecord, key: string, value: unknown): Promise<void> {
    await this.updateMonitor(monitor.id, (current) => { current.cursors[key] = value })
  }

  async updateCursorValue(monitor: MonitorRecord, key: string, update: (cursor: unknown) => unknown): Promise<void> {
    await this.updateMonitor(monitor.id, (current) => { current.cursors[key] = update(current.cursors[key]) })
  }

  async dedupe(): Promise<number> {
    return this.transact((registry) => {
      const deduped = dedupeActiveMonitors(registry.monitors)
      const removed = registry.monitors.length - deduped.length
      registry.monitors = deduped
      return removed
    })
  }

  private async updateMonitor(id: string, update: (monitor: MonitorRecord) => void): Promise<void> {
    await this.transact((registry) => {
      const monitor = registry.monitors.find((entry) => entry.id === id)
      if (!monitor) return
      update(monitor)
      monitor.updatedAt = new Date().toISOString()
    })
  }

  private transact<T>(operation: (registry: { monitors: MonitorRecord[] }) => T | Promise<T>): Promise<T> {
    const next = this.registryQueue.then(async () => {
      const registry = await this.store.load()
      const result = await operation(registry)
      await this.store.save(registry)
      return result
    })
    this.registryQueue = next.then(() => undefined, () => undefined)
    return next
  }
}
