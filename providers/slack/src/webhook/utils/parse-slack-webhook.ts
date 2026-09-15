import type { MonitorEvent } from "@sourcefed/core"
import { messageAt } from "../../utils"

export function parseSlackWebhook(payload: any, _eventName: string, deliveryId: string): MonitorEvent | undefined {
  const event = payload.event
  const channelId = event?.channel
  const threadTs = event?.thread_ts

  if (payload.type !== "event_callback" || event?.type !== "message" || !channelId) return undefined
  if (!threadTs && !channelId.startsWith("D")) return undefined

  let text = "[message without text]"
  if (event.text?.trim()) text = event.text.trim()
  let author = event.username
  if (!author) author = event.user
  if (!author) author = event.bot_id
  if (!author) author = "someone"
  let at = messageAt(event.event_ts)
  if (!event.event_ts) at = messageAt(event.ts)

  const source = threadTs
    ? { type: "slack", channelId, threadTs }
    : { type: "slack", channelId }
  const location = threadTs ? "thread" : "DM"

  return {
    source,
    kind: "message",
    id: event.ts === undefined ? undefined : `message:${event.ts}`,
    at,
    summary: `Slack ${location} message by ${author}`,
    body: `${text}\n\nSlack event: ${deliveryId}`,
    actionable: true,
  }
}
