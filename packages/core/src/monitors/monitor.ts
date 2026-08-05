import * as v from "valibot"
import type { MonitorContext, MonitorEvent, MonitorOptions, MonitorSchema } from "#sourcefed/types"
import type { MonitorSource, SourceInput } from "#sourcefed/sources"
import type { Delivery, MonitorCreateInput } from "#sourcefed/types"
import type { MonitorRecord } from "./types"
import type { PollMonitor } from "./poll"
import type { WebhookMonitor } from "./webhook"

export abstract class Monitor<TSource extends MonitorSource = MonitorSource> {
  readonly type: TSource["type"]
  private readonly schema: MonitorSchema<TSource>

  abstract readonly key: (source: TSource) => string
  abstract build(input: MonitorCreateInput): SourceInput

  readonly poll?: PollMonitor<TSource>
  readonly webhook?: WebhookMonitor<TSource>

  protected constructor(options: MonitorOptions<TSource>) {
    this.type = options.type
    this.schema = options.schema
  }

  validateSource(source: unknown): TSource {
    const result = v.safeParse(this.schema, source)
    if (result.success) return result.output
    throw new Error(`invalid ${this.type} monitor source`)
  }

  initialDelivery(source: unknown): Delivery {
    this.validateSource(source)
    if (this.webhook && this.webhook.preferred && this.webhook.configured()) return "webhook"
    if (this.poll) return "poll"
    if (this.webhook) return "webhook"
    throw new Error(`source ${this.type} has no configured transport`)
  }

  resolveDelivery(monitor: MonitorRecord): Delivery | undefined {
    let webhookHealthy = false
    if (this.webhook) webhookHealthy = this.webhook.isHealthy(monitor)

    if (monitor.delivery === "webhook") {
      if (this.webhook && webhookHealthy) return "webhook"
      if (this.poll) return "poll"
      if (this.webhook) return "webhook"
      return undefined
    }

    if (this.webhook && webhookHealthy) return "webhook"
    if (this.poll) return "poll"
    if (this.webhook) return "webhook"
    return undefined
  }

  async tick(context: MonitorContext, record: MonitorRecord): Promise<number> {
    const fresh = await context.service.get(record.id)
    if (!fresh || !fresh.enabled) return 0

    if (this.webhook) await this.webhook.retryPending(context, this, fresh)
    const current = await context.service.get(record.id)
    if (!current || !current.enabled) return 0

    const nextDelivery = this.resolveDelivery(current)
    if (!nextDelivery) return 0
    if (nextDelivery !== current.delivery) {
      await context.service.setDelivery(current.id, nextDelivery)
      current.delivery = nextDelivery
    }
    if (current.delivery !== "poll" || !this.poll) return 0

    const lastAttemptAt = Number(current.cursors.__lastAttemptAt ?? current.cursors.__lastPolledAt ?? 0)
    const pollIntervalSec = current.pollIntervalSec || 60
    if (lastAttemptAt && Date.now() - lastAttemptAt < pollIntervalSec * 1000) return 0
    return this.poll.run(context, this, current)
  }

  async deliver(context: MonitorContext, record: MonitorRecord, event: MonitorEvent, deliveryId: string): Promise<number> {
    if (!this.webhook) return 0
    return this.webhook.deliver(context, this, record, event, deliveryId)
  }

  unresponsive(record: MonitorRecord, now = Date.now()): boolean {
    if (!record.enabled) return false
    if (record.delivery === "poll") {
      if (!this.poll) return true
      return this.poll.isUnresponsive(record, now)
    }
    if (!this.webhook) return true
    return this.webhook.isUnresponsive(record, now)
  }
}
