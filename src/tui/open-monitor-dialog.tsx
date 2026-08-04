/** @jsxImportSource @opentui/solid */

import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { currentSessionID } from "./utils"
import { MonitorDialog } from "./monitor-dialog"

export function openMonitorDialog(api: TuiPluginApi): void {
  const sessionID = currentSessionID(api)
  if (sessionID) {
    api.ui.dialog.replace(() => <MonitorDialog api={api} sessionID={sessionID} />)
  } else {
    api.ui.dialog.replace(() => (
      <box flexDirection="column" padding={2}>
        <text fg={api.theme.current.accent}><b>Sourcefed monitors</b></text>
        <text fg={api.theme.current.textMuted}>Open this command from an active session.</text>
        <text fg={api.theme.current.textMuted}>Esc close</text>
      </box>
    ))
  }
  api.ui.dialog.setSize("xlarge")
}
