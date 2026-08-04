import type { MonitorCreateInput, MonitorSource, SourceInput } from "@sourcefed/core"
import type { Monitor } from "@sourcefed/core"
import { SOURCE_MAP } from "../registry.ts"

export function isSource(input: SourceInput): input is MonitorSource {
  return typeof (input as { type?: unknown }).type === "string"
}

export function sourceForInput(type: MonitorSource["type"], input: MonitorCreateInput): SourceInput {
  const source = SOURCE_MAP[type as keyof typeof SOURCE_MAP]
  return source.build(input) as SourceInput
}
