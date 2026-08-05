import * as v from "valibot"
import type { MonitorSource } from "#sourcefed/sources"
import type { MonitorContext } from "#sourcefed/types"
import type { MonitorRecord } from "../types"
import type { Monitor } from "../monitor"
import { RoutedEventCursorSchema, type PollMonitorOptions } from "./types"
import { eventDeliveryId } from "./utils/event-delivery-id.ts"

const activePolls = new Set<string>()

export class PollMonitor<TSource extends MonitorSource = MonitorSource> {
  constructor(private readonly options: PollMonitorOptions<TSource>) {}

  async run(context: MonitorContext, source: Monitor<TSource>, record: MonitorRecord): Promise<number> {
    if (activePolls.has(record.id)) return 0
    activePolls.add(record.id)
    try {
      const fresh = await context.service.get(record.id)
      if (!fresh) return 0

      const sourceRecord = source.validateSource(fresh.source)
      const cursorKey = source.key(sourceRecord)
      const result = await this.options.run(sourceRecord, fresh.cursors[cursorKey])

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
    if (lastPolledAt > 0) return now - lastPolledAt > intervalMs
    return now - Date.parse(record.createdAt) > intervalMs
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
