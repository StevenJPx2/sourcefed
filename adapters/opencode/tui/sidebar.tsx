/** @jsxImportSource @opentui/solid */

import { Show, createMemo, createSignal, onCleanup } from "solid-js"
import { connectDaemonClient, defaultDaemonUrl, type DaemonClient } from "@sourcefed/daemon"
import type { TuiPluginApi, TuiThemeCurrent } from "@opencode-ai/plugin/tui"
import type { RGBA } from "@opentui/core"

export type SidebarProps = {
  api: TuiPluginApi
  sessionID: string
}

type DisplayMonitor = {
  id: string
  name: string
  sourceType: string
  detail: string
  enabled: boolean
  delivery: string
}

const REFRESH_MS = 3_000

export function Sidebar(props: SidebarProps) {
  const [monitors, setMonitors] = createSignal<DisplayMonitor[]>([])
  const theme = createMemo(() => props.api.theme.current)
  const active = createMemo(() => monitors().filter((monitor) => monitor.enabled))

  const refresh = async () => {
    let client: DaemonClient | undefined
    try {
      client = await connectDaemonClient({ name: "sourcefed-opencode-tui", url: process.env.SOURCEFED_DAEMON_URL ?? defaultDaemonUrl() })
      const result = (await client.request("monitor.list", { target: { kind: "opencode-session", id: props.sessionID } })) as { ok?: boolean; monitors?: unknown[] }
      const list = result?.monitors ?? []
      setMonitors(list.map((monitor) => toDisplay(monitor as Record<string, unknown>)))
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

export function MonitorRows(props: { monitors: () => DisplayMonitor[]; theme: TuiThemeCurrent; compact?: boolean }) {
  const visible = createMemo(() => props.monitors().slice(0, 4))
  return (
    <box flexDirection="column" width="100%">
      <Show when={visible().length > 0} fallback={<text fg={props.theme.textMuted}>No active monitors</text>}>
        {visible().map((monitor) => (
          <box flexDirection="row" width="100%">
            <text fg={monitorTone(monitor, props.theme)}>{sourceIcon(monitor.sourceType)}</text>
            <text fg={props.theme.text}> {sourceLabel(monitor)}</text>
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

function toDisplay(monitor: Record<string, unknown>): DisplayMonitor {
  const source = (monitor.source ?? {}) as Record<string, unknown>
  return {
    id: String(monitor.id ?? ""),
    name: String(monitor.name ?? ""),
    sourceType: String(source.type ?? ""),
    detail: sourceDetail(source),
    enabled: Boolean(monitor.enabled),
    delivery: String(monitor.delivery ?? "poll"),
  }
}

const SOURCE_ICONS: Record<string, string> = {
  jira: "󰌃",
  github: "󰊤",
  slack: "󰒱",
}

const SOURCE_LABELS: Record<string, string> = {
  jira: "Jira",
  github: "GitHub",
  slack: "Slack",
}

function sourceIcon(type: string): string {
  return SOURCE_ICONS[type] ?? "?"
}

function sourceLabel(monitor: DisplayMonitor): string {
  return SOURCE_LABELS[monitor.sourceType] ?? monitor.sourceType
}

function sourceDetail(source: Record<string, unknown>): string {
  if (typeof source.repo === "string") return ` · ${source.repo}#${String(source.prNumber ?? "")}`
  if (typeof source.issueKey === "string") return ` · ${source.issueKey}`
  if (typeof source.channelId === "string") return ` · ${source.channelId}`
  return ""
}

function monitorTone(monitor: DisplayMonitor, theme: TuiThemeCurrent): RGBA {
  if (!monitor.enabled) return theme.textMuted
  return theme.success
}
