import { SOURCE_MAP } from "#sourcefed/sources"
import type { Monitor } from "#sourcefed/monitors"
import type { MonitorSource } from "#sourcefed/sources"

export function sourceDefinition(source: MonitorSource): Monitor<any> {
  return SOURCE_MAP[source.type]
}
