import * as v from "valibot"
import type { MonitorContext, MonitorEvent } from "#sourcefed/types"
import type { MonitorSource } from "#sourcefed/sources"
import type { MonitorRecord } from "../types"
import type { Monitor } from "../monitor"
import { WEBHOOK_STARTUP_GRACE_MS, WEBHOOK_STALE_MS } from "./utils/constants.ts"

import { PendingWebhookEventsSchema, type PendingWebhookEvent, type WebhookMonitorOptions } from "./types"

const pendingDeliveries = new Set<string>()
const PENDING_WEBHOOK_EVENTS = "__pendingWebhookEvents"

export class WebhookMonitor<TSource extends MonitorSource = MonitorSource> {
  readonly path: string
  readonly preferred: boolean
  readonly configured: () => boolean
  readonly verify: (body: string, request: Request) => boolean
  readonly acknowledgeBeforeDelivery: boolean
  readonly challenge?: (payload: unknown) => Record<string, string> | undefined
  readonly deliveryId: (request: Request, payload: unknown) => string | undefined
  readonly eventName: (request: Request, payload: unknown) => string
  readonly parse: (payload: unknown, eventName: string, deliveryId: string) => MonitorEvent | undefined
  readonly updateCursor?: (event: MonitorEvent, cursor: unknown) => unknown

  constructor(options: WebhookMonitorOptions) {
    this.path = options.path
    this.preferred = options.preferred ?? true
    this.configured = options.configured
    this.verify = options.verify
    this.acknowledgeBeforeDelivery = options.acknowledgeBeforeDelivery ?? false
    this.challenge = options.challenge
    this.deliveryId = options.deliveryId
    this.eventName = options.eventName
    this.parse = options.parse
    this.updateCursor = options.updateCursor
  }

  isHealthy(record: MonitorRecord): boolean {
    if (!this.preferred || !this.configured()) return false
    const heartbeatAt = Number(record.cursors.__webhookHeartbeatAt ?? 0)
    if (heartbeatAt > 0) return Date.now() - heartbeatAt <= WEBHOOK_STALE_MS
    return Date.now() - Date.parse(record.createdAt) <= WEBHOOK_STARTUP_GRACE_MS
  }

  isUnresponsive(record: MonitorRecord, now: number): boolean {
    const heartbeatAt = Number(record.cursors.__webhookHeartbeatAt ?? 0)
    if (heartbeatAt > 0) return now - heartbeatAt > WEBHOOK_STALE_MS
    return now - Date.parse(record.createdAt) > WEBHOOK_STARTUP_GRACE_MS
  }

  async retryPending(context: MonitorContext, source: Monitor<TSource>, record: MonitorRecord): Promise<number> {
    const fresh = await context.service.get(record.id)
    if (!fresh || !fresh.enabled) return 0
    const parsed = v.safeParse(PendingWebhookEventsSchema, fresh.cursors[PENDING_WEBHOOK_EVENTS])
    if (!parsed.success) return 0

    let delivered = 0
    for (const pending of parsed.output) {
      const current = await context.service.get(record.id)
      if (!current || !current.enabled) break
      const cursorKey = `webhook:${pending.deliveryId}`
      if (current.cursors[cursorKey]) {
        await this.removePending(context, current, pending.deliveryId)
        continue
      }
      delivered += await this.deliver(context, source, current, pending.event, pending.deliveryId)
    }
    return delivered
  }

  private async addPending(context: MonitorContext, monitor: MonitorRecord, deliveryId: string, event: MonitorEvent): Promise<void> {
    await context.service.updateCursorValue(monitor, PENDING_WEBHOOK_EVENTS, (cursor) => {
      const parsed = v.safeParse(PendingWebhookEventsSchema, cursor)
      let pending: PendingWebhookEvent[] = []
      if (parsed.success) pending = parsed.output
      if (pending.some((entry) => entry.deliveryId === deliveryId)) return pending
      pending.push({ deliveryId, event })
      return pending
    })
  }

  private async removePending(context: MonitorContext, monitor: MonitorRecord, deliveryId: string): Promise<void> {
    await context.service.updateCursorValue(monitor, PENDING_WEBHOOK_EVENTS, (cursor) => {
      const parsed = v.safeParse(PendingWebhookEventsSchema, cursor)
      if (!parsed.success) return []
      return parsed.output.filter((entry) => entry.deliveryId !== deliveryId)
    })
  }

  async deliver(context: MonitorContext, source: Monitor<TSource>, record: MonitorRecord, event: MonitorEvent, deliveryId: string): Promise<number> {
    const fresh = await context.service.get(record.id)
    if (!fresh || !fresh.enabled) return 0
    const freshSource = source.validateSource(fresh.source)
    const eventSource = source.validateSource(event.source)
    if (source.key(freshSource) !== source.key(eventSource)) return 0
    if (event.kind === "ci" && !event.actionable) return 0

    const cursorKey = `webhook:${deliveryId}`
    const reservationKey = `${fresh.id}:${deliveryId}`
    if (pendingDeliveries.has(reservationKey)) return 0
    if (fresh.cursors[cursorKey]) {
      await this.removePending(context, fresh, deliveryId)
      return 0
    }
    pendingDeliveries.add(reservationKey)
    try {
      await this.addPending(context, fresh, deliveryId, event)
      if (this.updateCursor) {
        const sourceCursorKey = source.key(freshSource)
        await context.service.updateCursorValue(fresh, sourceCursorKey, (cursor) => this.updateCursor!(event, cursor))
      }
      const result = await context.sink.deliver({ monitor: fresh, event })
      if (!result.ok) {
        console.error(`[sourcefed] webhook route failed for ${fresh.id}: ${result.error}`)
        return 0
      }
      await context.service.setDelivery(fresh.id, "webhook")
      await context.service.updateCursor(fresh, cursorKey, true)
      await this.removePending(context, fresh, deliveryId)
      if (event.terminal) await context.service.remove(fresh.id)
      return 1
    } finally {
      pendingDeliveries.delete(reservationKey)
    }
  }
}
