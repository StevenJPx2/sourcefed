import type { Client, MonitorEvent } from "#sourcefed/types"
import { sourceDefinition } from "#sourcefed/source-utils"
import { listMonitors } from "../../utils"
import type { Monitor } from "../../monitor"

export async function deliverWebhook(client: Client, source: Monitor, event: MonitorEvent, deliveryId: string): Promise<number> {
  let delivered = 0
  const monitors = await listMonitors()
  for (const monitor of monitors) {
    const monitorSource = sourceDefinition(monitor.source)
    if (monitorSource.type !== source.type) continue
    delivered += await monitorSource.deliver(client, monitor, event, deliveryId)
  }
  return delivered
}
