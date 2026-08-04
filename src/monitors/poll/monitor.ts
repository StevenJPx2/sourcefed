import * as v from "valibot"
import type { MonitorSource } from "#sourcefed/sources"
import type { Client } from "#sourcefed/types"
import { routeToSession } from "#sourcefed/utils"
import { getMonitor, removeMonitor, updateCursor } from "../utils"
import type { MonitorRecord } from "../types"
import type { Monitor } from "../monitor"
import { RoutedEventCursorSchema, type PollMonitorOptions } from "./types"
import { eventDeliveryId } from "./utils/event-delivery-id.ts"
import { withPollLock } from "./utils/with-poll-lock.ts"

export class PollMonitor<TSource extends MonitorSource = MonitorSource> {
  constructor(private readonly options: PollMonitorOptions<TSource>) {}

  async run(client: Client, source: Monitor<TSource>, record: MonitorRecord): Promise<number> {
    const routedCount = await withPollLock(record.id, async () => {
      const fresh = await getMonitor(record.id)
      if (!fresh) return 0

      const sourceRecord = source.validateSource(fresh.source)
      const cursorKey = source.key(sourceRecord)
      const result = await this.options.run(sourceRecord, fresh.cursors[cursorKey])

      const parsedRoutedIds = v.safeParse(RoutedEventCursorSchema, fresh.cursors.__routedEventIds)
      let routedIds: string[] = []
      if (parsedRoutedIds.success) routedIds = parsedRoutedIds.output
      let routeFailed = false
      for (const event of result.events) {
        const eventId = eventDeliveryId(event)
        if (routedIds.includes(eventId)) continue
        const routed = await routeToSession(client, fresh, event)
        if (!routed.ok) {
          routeFailed = true
          console.error(`[sourcefed] route failed for ${fresh.id}: ${routed.error}`)
          continue
        }
        if (!routedIds.includes(eventId)) routedIds.push(eventId)
      }
      if (routeFailed) {
        await updateCursor(fresh, "__routedEventIds", routedIds)
        return 0
      }

      await updateCursor(fresh, cursorKey, result.cursor)
      await updateCursor(fresh, "__routedEventIds", [])
      if (result.terminal) await removeMonitor(fresh.id)
      await updateCursor(fresh, "__lastPolledAt", Date.now())
      return result.events.length
    })
    if (routedCount === undefined) return 0
    return routedCount
  }

  isUnresponsive(record: MonitorRecord, now: number): boolean {
    const intervalMs = Math.max((record.pollIntervalSec || 60) * 3_000, 120_000)
    const lastPolledAt = Number(record.cursors.__lastPolledAt ?? 0)
    if (lastPolledAt > 0) return now - lastPolledAt > intervalMs
    return now - Date.parse(record.createdAt) > intervalMs
  }
}
