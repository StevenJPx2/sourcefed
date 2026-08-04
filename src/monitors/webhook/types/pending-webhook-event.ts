import * as v from "valibot"
import type { MonitorEvent } from "#sourcefed/types"

export type PendingWebhookEvent = {
  deliveryId: string
  event: MonitorEvent
}

const PendingWebhookEventSchema = v.object({
  deliveryId: v.string(),
  event: v.object({
    source: v.unknown(),
    kind: v.string(),
    id: v.optional(v.string()),
    at: v.string(),
    summary: v.string(),
    body: v.optional(v.string()),
    actionable: v.boolean(),
    terminal: v.optional(v.boolean()),
  }),
})

export const PendingWebhookEventsSchema = v.array(PendingWebhookEventSchema)
