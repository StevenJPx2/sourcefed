import { SOURCE_MAP } from "#sourcefed/sources"
import type { Monitor } from "#sourcefed/monitors"
import type { MonitorCreateInput } from "#sourcefed/types"
import type { MonitorSource } from "#sourcefed/sources"

export function sourceForInput(type: MonitorSource["type"], input: MonitorCreateInput): ReturnType<Monitor["build"]> {
  return SOURCE_MAP[type].build(input)
}
