import { Monitor } from "#sourcefed/monitors"
import type { Delivery, MonitorCreateInput } from "#sourcefed/types"
import type { SlackSourceRecord } from "./types"
import type { SourceInput } from "#sourcefed/sources"
import { SlackSourceSchema } from "./schema.ts"
import { slackPollMonitor } from "./poll"
import { slackWebhookMonitor } from "./webhook"

export class SlackMonitor extends Monitor<SlackSourceRecord> {
  readonly poll = slackPollMonitor
  readonly webhook = slackWebhookMonitor

  constructor() {
    super({ type: "slack", schema: SlackSourceSchema })
  }

  readonly key = (source: SlackSourceRecord): string => `slack:${source.channelId}#${source.threadTs}`
  readonly icon = "󰒱"
  readonly label = (): string => "thread"
  readonly detail = (source: SlackSourceRecord): string => ` · ${source.channelId}`
  readonly describe = (source: SlackSourceRecord): string => `Slack ${source.channelId} thread ${source.threadTs}`
  readonly cursorSummary = (cursor: Record<string, any>): string => `messages ${cursor.messageIds?.length ?? 0}, latest ${cursor.latestTs ?? "not checked"}`
  readonly deliveryHint = (delivery: Delivery): string => {
    if (delivery === "webhook") return "Slack webhook delivery is active; the monitor is detect-only."
    return "Slack webhook delivery is unavailable, so detect-only polling is active."
  }

  build(input: MonitorCreateInput): SourceInput {
    if (input.channelId && input.threadTs) return { type: "slack", channelId: input.channelId, threadTs: input.threadTs }
    if (!input.threadUrl) return { error: "channelId + threadTs or threadUrl is required for a slack monitor" }

    let url: URL
    try {
      url = new URL(input.threadUrl)
    } catch {
      return { error: "threadUrl must be a valid Slack URL" }
    }
    const channelId = url.pathname.match(/\/archives\/([^/]+)/)?.[1]
    const pathTimestamp = url.pathname.match(/\/p(\d{10,})/)?.[1]
    let threadTs = url.searchParams.get("thread_ts") ?? undefined
    if (!threadTs && pathTimestamp) threadTs = `${pathTimestamp.slice(0, -6)}.${pathTimestamp.slice(-6)}`
    if (channelId && threadTs) return { type: "slack", channelId, threadTs }
    return { error: "threadUrl does not contain a Slack channel and thread timestamp" }
  }
}
