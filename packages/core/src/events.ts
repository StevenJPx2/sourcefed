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

/** The most unacknowledged events a target holds. Past it the oldest go, and an `overflow` event says so. */
export const TARGET_QUEUE_LIMIT = 1_000

export class InMemoryMonitorEventQueue implements MonitorEventQueue {
  private readonly events: QueuedMonitorEvent[] = []

  constructor(private readonly limit = TARGET_QUEUE_LIMIT) {}

  async enqueue(input: { monitor: MonitorRecord; event: MonitorEvent }): Promise<QueuedMonitorEvent> {
    return appendQueued(this.events, createQueuedMonitorEvent(input.monitor, input.event), this.limit)
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

/**
 * Append an event to a queue, or return the queued one with its id. Past `limit`
 * events for the target, the oldest are dropped, and each monitor that lost
 * events has one `overflow` event, kept outside the limit and counting what it
 * lost, until the target acknowledges it.
 */
export function appendQueued(events: QueuedMonitorEvent[], queued: QueuedMonitorEvent, limit = TARGET_QUEUE_LIMIT): QueuedMonitorEvent {
  const existing = events.find((event) => event.id === queued.id)
  if (existing) return existing
  events.push(queued)

  const held = events.filter((event) => sameTarget(event.target, queued.target) && event.event.kind !== "overflow")
  const dropped = held.slice(0, Math.max(0, held.length - limit))
  if (dropped.length === 0) return queued

  const droppedIDs = new Set(dropped.map((event) => event.id))
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (droppedIDs.has(events[index].id)) events.splice(index, 1)
  }
  for (const lost of dropped) recordOverflow(events, lost)
  return queued
}

function recordOverflow(events: QueuedMonitorEvent[], lost: QueuedMonitorEvent): void {
  const id = `${lost.monitorID}:overflow`
  const existing = events.find((event) => event.id === id && sameTarget(event.target, lost.target))
  const dropped = Number(existing?.event.subject?.dropped ?? 0) + 1
  const at = new Date().toISOString()
  const event: MonitorEvent = {
    source: lost.event.source,
    kind: "overflow",
    id: "overflow",
    at,
    summary: `Sourcefed dropped ${dropped} unacknowledged ${dropped === 1 ? "event" : "events"} of monitor ${lost.monitorID}; re-list its source`,
    body: `A target holds at most ${TARGET_QUEUE_LIMIT.toLocaleString("en")} unacknowledged events, and the oldest go first. Acknowledge events once they are handled.`,
    actionable: true,
    subject: { type: "monitor", key: lost.monitorID, dropped },
  }
  if (existing) {
    existing.event = event
    return
  }
  events.push({ id, monitorID: lost.monitorID, target: lost.target, event, queuedAt: at })
}

export function monitorEventID(event: MonitorEvent): string {
  if (event.id) return event.id
  return `${event.kind}:${event.at}:${event.summary}`
}

function sameTarget(left: MonitorTarget, right: MonitorTarget): boolean {
  return left.kind === right.kind && left.id === right.id
}
