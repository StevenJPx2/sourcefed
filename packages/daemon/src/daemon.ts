import { JsonMonitorEventQueue, JsonMonitorStore, MonitorRuntime, type MonitorEventQueue, type MonitorRecord, type MonitorStore, type MonitorTarget, type QueuedMonitorEvent } from "@sourcefed/core"
import { isSource, SOURCE_MAP, SOURCE_TYPES, sourceDefinition, sourceForInput, sourceForWebhookPath } from "./registry.ts"
import type { DaemonCreateInput, DaemonResult, LogEntryView, MonitorView, SourcefedDaemonOptions } from "./types"
import { NotifyingEventSink, targetKey } from "./utils"

const DELIVERY_LOG_LIMIT = 100

export class SourcefedDaemon {
  readonly runtime: MonitorRuntime
  private readonly store: MonitorStore
  private readonly queue: MonitorEventQueue
  private readonly listeners = new Map<string, Set<(events: QueuedMonitorEvent[]) => void>>()
  private readonly observers = new Set<(target: MonitorTarget) => void>()
  private readonly received = new Map<string, Map<(events: QueuedMonitorEvent[]) => void, Set<string>>>()
  private readonly emitChains = new Map<string, Promise<void>>()
  private readonly deliveryLog = new Map<string, QueuedMonitorEvent[]>()
  private releaseExclusive?: () => Promise<void>
  private started = false

  constructor(options: SourcefedDaemonOptions = {}) {
    this.store = options.store ?? new JsonMonitorStore({ stateDir: options.stateDir })
    const queueDir = options.stateDir ?? (this.store instanceof JsonMonitorStore ? this.store.stateDir : undefined) ?? defaultStateDir()
    this.queue = options.eventQueue ?? new JsonMonitorEventQueue(queueDir)
    this.runtime = new MonitorRuntime({
      store: this.store,
      sink: new NotifyingEventSink(this.queue, (target) => this.emit(target)),
      sources: SOURCE_MAP,
      sourceForWebhookPath,
      pollLoopSec: options.pollLoopSec,
    })
  }

  get service() {
    return this.runtime.service
  }

  get sourceTypes(): readonly string[] {
    return SOURCE_TYPES
  }

  async start(): Promise<void> {
    if (this.started) return
    if (this.store.acquireExclusive) {
      this.releaseExclusive = await this.store.acquireExclusive()
    }
    try {
      await this.runtime.start()
      this.started = true
    } catch (error) {
      await this.releaseExclusive?.()
      this.releaseExclusive = undefined
      throw error
    }
  }

  async stop(): Promise<void> {
    const settled = await this.runtime.stop()
    if (!settled) {
      console.warn("[sourcefed] monitor ticks still in flight; keeping exclusive ownership of the state directory")
      return
    }
    await this.releaseExclusive?.()
    this.releaseExclusive = undefined
    this.started = false
  }

  async webhook(request: Request): Promise<Response> {
    return this.runtime.webhook(request)
  }

  async createMonitor(target: MonitorTarget, input: DaemonCreateInput): Promise<DaemonResult> {
    if (!(input.sourceType in SOURCE_MAP)) return { ok: false, error: `unknown source type ${input.sourceType}; expected ${SOURCE_TYPES.join("|")}` }
    const source = sourceForInput(input.sourceType, input)
    if (!isSource(source)) return { ok: false, error: (source as { error: string }).error }
    const definition = sourceDefinition(source)
    const result = await this.service.create({
      name: input.name,
      source,
      delivery: definition.initialDelivery(source),
      target,
      pollIntervalSec: input.pollIntervalSec ?? 60,
    })
    return { ok: true, created: result.created, monitor: monitorView(result.monitor) }
  }

  async listMonitors(target: MonitorTarget): Promise<DaemonResult> {
    const monitors = (await this.service.list()).filter((monitor) => sameTarget(monitor.target, target))
    return { ok: true, monitors: monitors.map(monitorView) }
  }

  async getMonitor(target: MonitorTarget, id: string): Promise<DaemonResult> {
    const monitor = await ownedMonitor(this.service, id, target)
    if (!monitor) return { ok: false, error: `monitor ${id} was not found for this target` }
    return { ok: true, monitor: monitorView(monitor) }
  }

  async stopMonitor(target: MonitorTarget, id: string): Promise<DaemonResult> {
    const monitor = await ownedMonitor(this.service, id, target)
    if (!monitor) return { ok: false, error: `monitor ${id} was not found for this target` }
    const stopped = await this.service.stop(id)
    if ("error" in stopped) return { ok: false, error: stopped.error }
    return { ok: true, monitor: monitorView(stopped) }
  }

  async startMonitor(target: MonitorTarget, id: string): Promise<DaemonResult> {
    const monitor = await ownedMonitor(this.service, id, target)
    if (!monitor) return { ok: false, error: `monitor ${id} was not found for this target` }
    const started = await this.service.start(id)
    if ("error" in started) return { ok: false, error: started.error }
    return { ok: true, monitor: monitorView(started) }
  }

  async removeMonitor(target: MonitorTarget, id: string): Promise<DaemonResult> {
    const monitor = await ownedMonitor(this.service, id, target)
    if (!monitor) return { ok: false, error: `monitor ${id} was not found for this target` }
    await this.service.remove(id)
    return { ok: true, removed: true }
  }

  async readEvents(target: MonitorTarget): Promise<QueuedMonitorEvent[]> {
    return this.queue.read(target)
  }

  async readLogs(target: MonitorTarget): Promise<LogEntryView[]> {
    return (this.deliveryLog.get(targetKey(target)) ?? []).map(logEntryView)
  }

  async acknowledgeEvents(target: MonitorTarget, eventIDs: string[]): Promise<DaemonResult> {
    const queued = await this.queue.read(target)
    const acked = queued.filter((event) => eventIDs.includes(event.id))
    await this.queue.acknowledge(target, eventIDs)
    if (acked.length > 0) this.appendLog(target, acked)
    const receivedByListener = this.received.get(targetKey(target))
    if (receivedByListener) {
      const ids = new Set(eventIDs)
      for (const received of receivedByListener.values()) {
        for (const id of ids) received.delete(id)
      }
      for (const [listener, received] of receivedByListener) {
        if (received.size === 0) receivedByListener.delete(listener)
      }
    }
    return { ok: true, acknowledged: eventIDs }
  }

  subscribe(target: MonitorTarget, onEvents: (events: QueuedMonitorEvent[]) => void): () => void {
    const key = targetKey(target)
    let listeners = this.listeners.get(key)
    if (!listeners) {
      listeners = new Set()
      this.listeners.set(key, listeners)
    }
    listeners.add(onEvents)
    return () => {
      listeners.delete(onEvents)
      if (listeners.size === 0) {
        this.listeners.delete(key)
        this.received.delete(key)
      }
    }
  }

  observe(onEvent: (target: MonitorTarget) => void): () => void {
    this.observers.add(onEvent)
    return () => this.observers.delete(onEvent)
  }

  private appendLog(target: MonitorTarget, events: QueuedMonitorEvent[]): void {
    const key = targetKey(target)
    const existing = this.deliveryLog.get(key) ?? []
    const merged = [...events.reverse(), ...existing] // newest first
    this.deliveryLog.set(key, merged.slice(0, DELIVERY_LOG_LIMIT))
  }

  private emit(target: MonitorTarget): void {
    for (const observer of this.observers) observer(target)
    const key = targetKey(target)
    const listeners = this.listeners.get(key)
    if (!listeners || listeners.size === 0) return
    const previous = this.emitChains.get(key) ?? Promise.resolve()
    const next = previous.then(() => this.deliver(key, target, listeners)).catch((error) => {
      console.error(`[sourcefed] event delivery failed: ${error instanceof Error ? error.message : String(error)}`)
    })
    this.emitChains.set(key, next)
    void next.finally(() => {
      if (this.emitChains.get(key) === next) this.emitChains.delete(key)
    })
  }

  private async deliver(key: string, target: MonitorTarget, listeners: Set<(events: QueuedMonitorEvent[]) => void>): Promise<void> {
    const queued = await this.queue.read(target)
    if (queued.length === 0) return
    let receivedByListener = this.received.get(key)
    if (!receivedByListener) {
      receivedByListener = new Map()
      this.received.set(key, receivedByListener)
    }
    const listenerResults = [...listeners].map(async (listener) => {
      let received = receivedByListener.get(listener)
      if (!received) {
        received = new Set()
        receivedByListener.set(listener, received)
      }
      const fresh = queued.filter((event) => !received.has(event.id))
      if (fresh.length === 0) return
      for (const event of fresh) received.add(event.id)
      try {
        await listener(fresh)
      } catch (error) {
        console.error(`[sourcefed] event delivery failed: ${error instanceof Error ? error.message : String(error)}`)
        for (const event of fresh) received.delete(event.id)
      }
    })
    await Promise.all(listenerResults)
  }
}

export function monitorView(monitor: MonitorRecord): MonitorView {
  const definition = sourceDefinition(monitor.source)
  return {
    id: monitor.id,
    name: monitor.name,
    source: monitor.source,
    target: monitor.target,
    delivery: monitor.delivery,
    pollIntervalSec: monitor.pollIntervalSec,
    enabled: monitor.enabled,
    createdAt: monitor.createdAt,
    updatedAt: monitor.updatedAt,
    icon: definition.icon,
    label: definition.label(monitor.source),
    detail: definition.detail(monitor.source),
    describe: definition.describe(monitor.source),
  }
}

export function logEntryView(queued: QueuedMonitorEvent): LogEntryView {
  const definition = sourceDefinition(queued.event.source as { type: string })
  return {
    id: queued.id,
    monitorID: queued.monitorID,
    at: queued.event.at,
    kind: queued.event.kind,
    summary: queued.event.summary,
    body: queued.event.body,
    actionable: queued.event.actionable,
    icon: definition.icon,
    describe: definition.describe(queued.event.source as never),
  }
}

async function ownedMonitor(service: SourcefedDaemon["service"], id: string, target: MonitorTarget): Promise<MonitorRecord | undefined> {
  const monitor = await service.get(id)
  return monitor && sameTarget(monitor.target, target) ? monitor : undefined
}

function sameTarget(left: MonitorTarget, right: MonitorTarget): boolean {
  return left.kind === right.kind && left.id === right.id
}

function defaultStateDir(): string {
  return process.env.SOURCEFED_STATE_DIR ?? `${process.env.XDG_STATE_HOME ?? `${process.env.HOME ?? "."}/.local/state`}/sourcefed`
}
