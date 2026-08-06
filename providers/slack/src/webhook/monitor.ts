import { WebhookMonitor } from "@sourcefed/core"
import { validSlackSignature } from "./utils"
import { parseSlackWebhook } from "./utils"
import { updateSlackCursor } from "./utils/update-slack-cursor.ts"
import type { SlackSourceRecord } from "../types"

export const slackWebhookMonitor = new WebhookMonitor<SlackSourceRecord>({
  path: "/webhooks/slack",
  preferred: true,
  configured: () => Boolean(process.env.SOURCEFED_SLACK_SIGNING_SECRET),
  verify: (body: string, request: Request) => validSlackSignature(body, request),
  acknowledgeBeforeDelivery: true,
  challenge: (payload: any) => {
    if (payload.type === "url_verification" && payload.challenge) return { challenge: payload.challenge }
    return undefined
  },
  deliveryId: (_request: Request, payload: any) => payload.event_id,
  eventName: () => "slack",
  parse: parseSlackWebhook,
  updateCursor: updateSlackCursor,
})
