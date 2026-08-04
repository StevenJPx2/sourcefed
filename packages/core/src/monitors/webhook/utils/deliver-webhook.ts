import type { MonitorContext, MonitorEvent } from "#sourcefed/types"
import type { Monitor } from "../../monitor"

export async function deliverWebhook(context: MonitorContext, source: Monitor, event: MonitorEvent, deliveryId: string): Promise<number> {
  let delivered = 0
  const monitors = await context.service.list()
  for (const monitor of monitors) {
    const monitorSource = context.sources[monitor.source.type] as Monitor | undefined
    if (!monitorSource) continue
    if (monitorSource.type !== source.type) continue
    delivered += await monitorSource.deliver(context, monitor, event, deliveryId)
  }
  return delivered
}
