import type { MonitorRecord } from "../types"
import { withMonitorRegistry } from "./with-monitor-registry.ts"

export async function stopMonitor(id: string): Promise<MonitorRecord | { error: string }> {
  return withMonitorRegistry((registry) => {
    const monitor = registry.monitors.find((entry) => entry.id === id)
    if (!monitor) return { error: `monitor ${id} was not found` }
    monitor.enabled = false
    monitor.updatedAt = new Date().toISOString()
    return monitor
  })
}
