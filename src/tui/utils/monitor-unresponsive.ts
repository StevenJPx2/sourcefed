import type { MonitorRecord } from "#sourcefed/monitors"
import { sourceDefinition } from "#sourcefed/source-utils"

export function monitorUnresponsive(monitor: MonitorRecord): boolean {
  return sourceDefinition(monitor.source).unresponsive(monitor)
}
