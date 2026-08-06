import type { MonitorContext } from "#sourcefed/types"
import type { Monitor } from "../../monitor"

export async function heartbeatWebhooks(context: MonitorContext, source: Monitor, eventSource: unknown): Promise<void> {
  const sourceKey = source.key(source.validateSource(eventSource))
  const monitors = await context.service.list()
  for (const monitor of monitors) {
    if (!monitor.enabled || monitor.source.type !== source.type) continue
    if (source.key(source.validateSource(monitor.source)) !== sourceKey) continue
    await context.service.updateCursor(monitor, "__webhookHeartbeatAt", Date.now())
  }
}
