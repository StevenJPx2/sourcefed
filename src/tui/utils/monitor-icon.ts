import type { MonitorRecord } from "#sourcefed/monitors"
import { sourceDefinition } from "#sourcefed/source-utils"
import { SPINNER_FRAMES } from "../constants.ts"
import { monitorUnresponsive } from "./monitor-unresponsive.ts"

export function monitorIcon(monitor: MonitorRecord, frame: number): string {
  if (monitorUnresponsive(monitor)) return SPINNER_FRAMES[frame % SPINNER_FRAMES.length]
  return sourceDefinition(monitor.source).icon
}
