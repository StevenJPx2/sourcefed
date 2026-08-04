import type { MonitorRecord } from "../types"
import { withMonitorRegistry } from "./with-monitor-registry.ts"

export async function updateCursorValue(
  monitor: MonitorRecord,
  key: string,
  update: (cursor: unknown) => unknown,
): Promise<void> {
  await withMonitorRegistry((registry) => {
    const current = registry.monitors.find((entry) => entry.id === monitor.id)
    if (!current) return
    current.cursors[key] = update(current.cursors[key])
    current.updatedAt = new Date().toISOString()
  })
}
