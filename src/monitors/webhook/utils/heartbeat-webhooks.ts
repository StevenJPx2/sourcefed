import { listMonitors, updateCursor } from "../../utils"
import type { Monitor } from "../../monitor"

export async function heartbeatWebhooks(source: Monitor, eventSource: unknown): Promise<void> {
  const sourceKey = source.key(source.validateSource(eventSource))
  const monitors = await listMonitors()
  for (const monitor of monitors) {
    if (!monitor.enabled || monitor.source.type !== source.type) continue
    if (source.key(source.validateSource(monitor.source)) !== sourceKey) continue
    await updateCursor(monitor, "__webhookHeartbeatAt", Date.now())
  }
}
