import * as v from "valibot"
import type { MonitorRecord } from "#sourcefed/monitors"
import { sourceDefinition } from "#sourcefed/source-utils"

export function sourceCursor(monitor: MonitorRecord): Record<string, any> {
  const key = sourceDefinition(monitor.source).key(monitor.source)
  const result = v.safeParse(v.record(v.string(), v.unknown()), monitor.cursors[key])
  if (result.success) return result.output
  return {}
}
