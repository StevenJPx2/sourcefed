import type { Delivery } from "#sourcefed/types"
import type { MonitorRecord } from "../types"
import { withMonitorRegistry } from "./with-monitor-registry.ts"

export async function setDelivery(id: string, delivery: Delivery): Promise<MonitorRecord | undefined> {
  return withMonitorRegistry((registry) => {
    const monitor = registry.monitors.find((entry) => entry.id === id)
    if (!monitor) return undefined
    monitor.delivery = delivery
    monitor.updatedAt = new Date().toISOString()
    return monitor
  })
}
