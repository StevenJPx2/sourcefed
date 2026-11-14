import * as v from "valibot"
import type { MonitorSource } from "#sourcefed/sources"
import type { MonitorContext } from "#sourcefed/types"
import type { MonitorRecord } from "../types"
import type { Monitor } from "../monitor"
import { RoutedEventCursorSchema, type PollMonitorOptions } from "./types"
import { eventDeliveryId } from "./utils/event-delivery-id.ts"

const activePolls = new Set<string>()

// A monitor deferred this recently is still waiting; older marks are dropped, since a
// monitor that keeps being deferred is marked again on every tick.
const DEFERRED_MARK_MS = 10 * 60_000
// However long a source defers a monitor, it shows as unresponsive once its last read is
// this many intervals old (and at least this long).
const DEFERRED_GRACE_INTERVALS = 10
const MIN_DEFERRED_GRACE_MS = 15 * 60_000

export class PollMonitor<TSource extends MonitorSource = MonitorSource> {
  // When each monitor's poll was last deferred. In memory only: it answers whether a
  // monitor is waiting its turn now, and a deferred poll must not write the store.
  private readonly deferredAt = new Map<string, number>()

  constructor(private readonly options: PollMonitorOptions<TSource>) {}

  async run(context: MonitorContext, source: Monitor<TSource>, record: MonitorRecord): Promise<number> {
    if (activePolls.has(record.id)) return 0
    activePolls.add(record.id)
    try {
      const fresh = await context.service.get(record.id)
      if (!fresh) {
        this.deferredAt.delete(record.id)
        return 0
      }

      const sourceRecord = source.validateSource(fresh.source)
      const cursorKey = source.key(sourceRecord)
      const result = await this.options.run(sourceRecord, fresh.cursors[cursorKey], fresh.id)
      // A deferred poll made no request: no cursor or poll stamp changes, so the monitor stays due.
      if ("deferred" in result) {
        this.markDeferred(fresh.id, Date.now())
        return 0
      }
      this.deferredAt.delete(fresh.id)

      const current = await context.service.get(record.id)
      if (!current || !current.enabled) return 0

      const parsedRoutedIds = v.safeParse(RoutedEventCursorSchema, fresh.cursors.__routedEventIds)
      let routedIds: string[] = []
      if (parsedRoutedIds.success) routedIds = parsedRoutedIds.output
      let routeFailed = false
      for (const event of result.events) {
        const eventId = eventDeliveryId(event)
        if (routedIds.includes(eventId)) continue
        const routed = await context.sink.deliver({ monitor: fresh, event })
        if (!routed.ok) {
          routeFailed = true
          console.error(`[sourcefed] route failed for ${fresh.id}: ${routed.error}`)
          continue
        }
        if (!routedIds.includes(eventId)) routedIds.push(eventId)
      }
      if (routeFailed) {
        await context.service.updateCursor(fresh, "__routedEventIds", routedIds)
        return 0
      }

      await context.service.updateCursorValue(fresh, cursorKey, (current) => {
        if (this.options.mergeCursor) return this.options.mergeCursor(current, result.cursor)
        return result.cursor
      })
      await context.service.updateCursor(fresh, "__routedEventIds", [])
      if (result.terminal) await context.service.remove(fresh.id)
      await context.service.updateCursor(fresh, "__lastPolledAt", Date.now())
      return result.events.length
    } finally {
      activePolls.delete(record.id)
    }
  }

  isUnresponsive(record: MonitorRecord, now: number): boolean {
    const intervalMs = Math.max((record.pollIntervalSec || 60) * 3_000, 120_000)
    const lastPolledAt = Number(record.cursors.__lastPolledAt ?? 0)
    const lastReadAt = lastPolledAt > 0 ? lastPolledAt : Date.parse(record.createdAt)
    const sinceRead = now - lastReadAt
    // A monitor whose source keeps deferring it is waiting its turn, not failing, until its
    // last read is so old that waiting no longer explains it.
    const deferredAt = this.deferredAt.get(record.id)
    const graceMs = Math.max(DEFERRED_GRACE_INTERVALS * intervalMs, MIN_DEFERRED_GRACE_MS)
    if (deferredAt !== undefined && now - deferredAt <= intervalMs && sinceRead <= graceMs) return false
    return sinceRead > intervalMs
  }

  // Marks a deferred poll and drops marks of monitors no longer being deferred (removed,
  // disabled, or reading again), so the map holds only monitors waiting now.
  private markDeferred(id: string, now: number): void {
    this.deferredAt.set(id, now)
    for (const [other, at] of this.deferredAt) {
      if (now - at > DEFERRED_MARK_MS) this.deferredAt.delete(other)
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function mergeCursors(current: unknown, result: unknown): unknown {
  if (Array.isArray(current) && Array.isArray(result)) {
    return [...new Set([...current, ...result])]
  }
  if (isRecord(current) && isRecord(result)) {
    const merged: Record<string, unknown> = { ...current }
    for (const [key, value] of Object.entries(result)) {
      if (value === undefined) continue
      merged[key] = key in current ? mergeCursors(current[key], value) : value
    }
    return merged
  }
  return result === undefined ? current : result
}
