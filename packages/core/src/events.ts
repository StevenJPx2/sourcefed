import type { MonitorRecord } from "./monitors"
import type { MonitorEvent, MonitorEventQueue, MonitorEventSink, MonitorTarget, QueuedMonitorEvent } from "./types"

export class QueueMonitorEventSink implements MonitorEventSink {
  constructor(readonly queue: MonitorEventQueue) {}

  async deliver(input: { monitor: MonitorRecord; event: MonitorEvent }): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.queue.enqueue(input)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}

export class InMemoryMonitorEventQueue implements MonitorEventQueue {
  private readonly events: QueuedMonitorEvent[] = []

  async enqueue(input: { monitor: MonitorRecord; event: MonitorEvent }): Promise<QueuedMonitorEvent> {
    const queued = createQueuedMonitorEvent(input.monitor, input.event)
    const existing = this.events.find((event) => event.id === queued.id)
    if (existing) return existing
    this.events.push(queued)
    return queued
  }

  async read(target: MonitorTarget): Promise<QueuedMonitorEvent[]> {
    return this.events.filter((event) => sameTarget(event.target, target)).map((event) => structuredClone(event))
  }

  async acknowledge(target: MonitorTarget, eventIDs: string[]): Promise<void> {
    const ids = new Set(eventIDs)
    for (let index = this.events.length - 1; index >= 0; index -= 1) {
      if (sameTarget(this.events[index].target, target) && ids.has(this.events[index].id)) this.events.splice(index, 1)
    }
  }
}

export function createQueuedMonitorEvent(monitor: MonitorRecord, event: MonitorEvent): QueuedMonitorEvent {
  return {
    id: `${monitor.id}:${monitorEventID(event)}`,
    monitorID: monitor.id,
    target: monitor.target,
    event,
    queuedAt: new Date().toISOString(),
  }
}

export function monitorEventID(event: MonitorEvent): string {
  if (event.id) return event.id
  return `${event.kind}:${event.at}:${event.summary}`
}

function sameTarget(left: MonitorTarget, right: MonitorTarget): boolean {
  return left.kind === right.kind && left.id === right.id
}
