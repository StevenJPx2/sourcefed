/** @jsxImportSource @opentui/solid */

import { Show, createMemo, createSignal, onCleanup } from "solid-js"
import { connectDaemonClient, defaultDaemonUrl, type DaemonClient, type MonitorView } from "@sourcefed/daemon"
import type { TuiPluginApi, TuiThemeCurrent } from "@opencode-ai/plugin/tui"

export type SidebarProps = {
  api: TuiPluginApi
  sessionID: string
}

const REFRESH_MS = 3_000

export function Sidebar(props: SidebarProps) {
  const [monitors, setMonitors] = createSignal<MonitorView[]>([])
  const theme = createMemo(() => props.api.theme.current)
  const active = createMemo(() => monitors().filter((monitor) => monitor.enabled))

  const refresh = async () => {
    let client: DaemonClient | undefined
    try {
      client = await connectDaemonClient({ name: "sourcefed-opencode-tui", url: process.env.SOURCEFED_DAEMON_URL ?? defaultDaemonUrl() })
      const result = (await client.request("monitor.list", { target: { kind: "opencode-session", id: props.sessionID } })) as { ok?: boolean; monitors?: MonitorView[] }
      setMonitors(result?.monitors ?? [])
    } catch {
      setMonitors([])
    } finally {
      await client?.close()
    }
  }

  void refresh()
  const timer = setInterval(() => void refresh(), REFRESH_MS)
  onCleanup(() => clearInterval(timer))

  return (
    <box flexDirection="column" width="100%" marginTop={1}>
      <box flexDirection="row" width="100%">
        <text fg={theme().accent}>Sourcefed</text>
        <text fg={theme().textMuted}> ({active().length})</text>
      </box>
      <MonitorRows monitors={active} theme={theme()} compact />
    </box>
  )
}

export function MonitorRows(props: { monitors: () => MonitorView[]; theme: TuiThemeCurrent; compact?: boolean }) {
  const visible = createMemo(() => props.monitors().slice(0, 4))
  return (
    <box flexDirection="column" width="100%">
      <Show when={visible().length > 0} fallback={<text fg={props.theme.textMuted}>No active monitors</text>}>
        {visible().map((monitor) => (
          <box flexDirection="row" width="100%">
            <text fg={monitorTone(monitor, props.theme)}>{monitor.icon}</text>
            <text fg={props.theme.textMuted}>{monitor.detail}</text>
          </box>
        ))}
      </Show>
      <Show when={props.compact && visible().length < props.monitors().length}>
        <text fg={props.theme.textMuted}>Open Sourcefed for more</text>
      </Show>
    </box>
  )
}

function monitorTone(monitor: MonitorView, theme: TuiThemeCurrent): TuiThemeCurrent["textMuted"] {
  if (!monitor.enabled) return theme.textMuted
  return theme.success
}
