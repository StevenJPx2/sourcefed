/** @jsxImportSource @opentui/solid */

import { createMemo } from "solid-js"
import type { SidebarProps } from "./types"
import { useMonitors } from "./utils"
import { MonitorRows } from "./monitor-rows"

export function Sidebar(props: SidebarProps) {
  const { monitors } = useMonitors(props.sessionID)
  const theme = createMemo(() => props.api.theme.current)
  const count = createMemo(() => monitors().filter((monitor) => monitor.enabled).length)

  return (
    <box flexDirection="column" width="100%" marginTop={1}>
      <box flexDirection="row" width="100%">
        <text fg={theme().accent}>Sourcefed</text>
        <text fg={theme().textMuted}> ({count()})</text>
      </box>
      <MonitorRows monitors={monitors} theme={theme()} compact />
    </box>
  )
}
