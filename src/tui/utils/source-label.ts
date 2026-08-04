import type { MonitorRecord } from "#sourcefed/monitors"
import { sourceDefinition } from "#sourcefed/source-utils"

export function sourceLabel(monitor: MonitorRecord): string {
  return sourceDefinition(monitor.source).label(monitor.source)
}
