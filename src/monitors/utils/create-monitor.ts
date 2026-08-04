import type { MonitorRecord } from "../types"
import { withMonitorRegistry } from "./with-monitor-registry.ts"

export async function createMonitor(
  input: Pick<MonitorRecord, "name" | "source" | "delivery" | "sessionID" | "pollIntervalSec">,
): Promise<MonitorRecord> {
  return withMonitorRegistry((registry) => {
    const now = new Date().toISOString()
    const monitor: MonitorRecord = {
      id: `m-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`,
      name: input.name,
      source: input.source,
      delivery: input.delivery,
      sessionID: input.sessionID,
      pollIntervalSec: Math.max(15, input.pollIntervalSec || 60),
      enabled: true,
      createdAt: now,
      updatedAt: now,
      cursors: {},
    }
    registry.monitors.push(monitor)
    return monitor
  })
}
