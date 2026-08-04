import type { Monitor, MonitorSource } from "@sourcefed/core"
import { SOURCE_MAP } from "../registry.ts"

export function sourceDefinition(source: MonitorSource): Monitor<any> {
  return SOURCE_MAP[source.type as keyof typeof SOURCE_MAP]
}
