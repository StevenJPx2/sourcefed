import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui"
import type { MonitorRecord } from "#sourcefed/monitors"
import { monitorUnresponsive } from "./monitor-unresponsive.ts"

export function monitorTone(monitor: MonitorRecord, theme: TuiThemeCurrent): TuiThemeCurrent["success"] {
  if (!monitor.enabled) return theme.textMuted
  if (monitorUnresponsive(monitor)) return theme.error
  return theme.success
}
