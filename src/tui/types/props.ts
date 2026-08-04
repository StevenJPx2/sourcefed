import type { TuiPluginApi, TuiThemeCurrent } from "@opencode-ai/plugin/tui"
import type { MonitorRecord } from "#sourcefed/monitors"

export type MonitorRowsProps = {
  monitors: () => MonitorRecord[]
  theme: TuiThemeCurrent
  compact?: boolean
}

export type SidebarProps = {
  api: TuiPluginApi
  sessionID: string
}

export type DetailRowProps = {
  theme: TuiThemeCurrent
  label: string
  value: string
}

export type MonitorCardProps = {
  monitor: MonitorRecord
  theme: TuiThemeCurrent
}

export type MonitorDialogProps = {
  api: TuiPluginApi
  sessionID: string
}
