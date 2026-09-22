/** @jsxImportSource @opentui/solid */

import { Show, createMemo, createSignal, onCleanup } from "solid-js"
import { connectDaemonClient, defaultDaemonUrl, type DaemonClient, type MonitorView } from "@sourcefed/daemon"
import type { Plugin } from "@opencode/plugin/tui"

type ThemeTokens = Plugin.Context["theme"]
type Color = ThemeTokens["text"]["base"]

// V2 theme tokens are deeply nested; flatten the handful the sidebar and dialogs
// use into a flat palette so the JSX stays legible.
export type Tone = Record<"text" | "textMuted" | "accent" | "success" | "error" | "warning", Color>

export function tone(theme: ThemeTokens): Tone {
  return {
    text: theme.text.base,
    textMuted: theme.text.muted,
    accent: theme.text.action.primary.base,
    success: theme.text.feedback.success.base,
    error: theme.text.feedback.error.base,
    warning: theme.text.feedback.warning.base,
  }
}

export type SidebarProps = {
  ctx: Plugin.Context
  sessionID: string
}

const REFRESH_MS = 3_000

export function Sidebar(props: SidebarProps) {
  const [monitors, setMonitors] = createSignal<MonitorView[]>([])
  const palette = createMemo(() => tone(props.ctx.theme))
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
        <text fg={palette().accent}>Sourcefed</text>
        <text fg={palette().textMuted}> ({active().length})</text>
      </box>
      <MonitorRows monitors={active} tone={palette()} compact />
    </box>
  )
}

export function MonitorRows(props: { monitors: () => MonitorView[]; tone: Tone; compact?: boolean }) {
  const visible = createMemo(() => props.monitors().slice(0, 4))
  return (
    <box flexDirection="column" width="100%">
      <Show when={visible().length > 0} fallback={<text fg={props.tone.textMuted}>No active monitors</text>}>
        {visible().map((monitor) => (
          <box flexDirection="row" width="100%">
            <text fg={monitorTone(monitor, props.tone)}>{monitor.icon}</text>
            <text fg={props.tone.textMuted}> {monitor.name}</text>
          </box>
        ))}
      </Show>
      <Show when={props.compact && visible().length < props.monitors().length}>
        <text fg={props.tone.textMuted}>Open Sourcefed for more</text>
      </Show>
    </box>
  )
}

function monitorTone(monitor: MonitorView, tone: Tone): Color {
  if (!monitor.enabled) return tone.textMuted
  return tone.success
}
