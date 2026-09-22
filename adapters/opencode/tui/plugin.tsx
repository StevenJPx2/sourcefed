/** @jsxImportSource @opentui/solid */

import { createMemo, Show } from "solid-js"
import type { Plugin } from "@opencode/plugin/tui"
import { connectDaemonClient, defaultDaemonUrl, type DaemonClient, type LogEntryView, type MonitorView } from "@sourcefed/daemon"
import { Sidebar, tone, type Tone } from "./sidebar.tsx"

export const sourcefedTui = (ctx: Plugin.Context): (() => void) => {
  let client: DaemonClient | undefined

  const getClient = async (): Promise<DaemonClient> => {
    if (!client) {
      client = await connectDaemonClient({
        name: "sourcefed-opencode-tui",
        url: process.env.SOURCEFED_DAEMON_URL ?? defaultDaemonUrl(),
      })
    }
    return client
  }

  const currentSessionID = (): string | undefined => {
    const route = ctx.ui.router.current()
    return route.type === "session" ? route.sessionID : undefined
  }

  const disposeSlot = ctx.ui.slot({
    append: "sidebar.content",
    render: ({ sessionID }) => <Sidebar ctx={ctx} sessionID={sessionID} />,
  })

  const disposeKeymapSlot = ctx.ui.slot({
    append: "app",
    render: () => <KeymapRegistration ctx={ctx} currentSessionID={currentSessionID} getClient={getClient} />,
  })

  return () => {
    disposeSlot()
    disposeKeymapSlot()
    void client?.close()
  }
}

function KeymapRegistration(props: {
  ctx: Plugin.Context
  currentSessionID: () => string | undefined
  getClient: () => Promise<DaemonClient>
}) {
  const { ctx, currentSessionID, getClient } = props

  ctx.keymap.layer(() => ({
    mode: "global",
    commands: [
      {
        id: "sourcefed",
        title: "Sourcefed monitors",
        description: "Show monitors for the current OpenCode session",
        slash: { name: "sourcefed" },
        run: async () => {
          const id = currentSessionID()

          if (!id) {
            ctx.ui.toast.show({ variant: "warning", message: "No active OpenCode session" })
            return
          }

          try {
            const daemon = await getClient()
            const result = (await daemon.request("monitor.list", { target: { kind: "opencode-session", id } })) as { monitors?: MonitorView[] }
            const monitors = result?.monitors ?? []
            ctx.ui.dialog.set({ size: "large" })
            ctx.ui.dialog.show(() => <MonitorDialog ctx={ctx} monitors={monitors} />)
          } catch (error) {
            ctx.ui.toast.show({ variant: "error", message: `Sourcefed daemon unavailable: ${error instanceof Error ? error.message : String(error)}` })
          }
        },
      },
      {
        id: "sourcefed-logs",
        title: "Sourcefed logs",
        description: "Show recent Sourcefed notifications for the current OpenCode session",
        slash: { name: "sourcefed-logs" },
        run: async () => {
          const id = currentSessionID()

          if (!id) {
            ctx.ui.toast.show({ variant: "warning", message: "No active OpenCode session" })
            return
          }

          try {
            const daemon = await getClient()
            const result = (await daemon.request("monitor.logs", { target: { kind: "opencode-session", id } })) as { logs?: LogEntryView[] }
            const logs = result?.logs ?? []
            ctx.ui.dialog.set({ size: "large" })
            ctx.ui.dialog.show(() => <LogsDialog ctx={ctx} logs={logs} />)
          } catch (error) {
            ctx.ui.toast.show({ variant: "error", message: `Sourcefed daemon unavailable: ${error instanceof Error ? error.message : String(error)}` })
          }
        },
      },
    ],
  }))

  return null
}

function MonitorDialog(props: { ctx: Plugin.Context; monitors: MonitorView[] }) {
  const palette = createMemo(() => tone(props.ctx.theme))
  const active = props.monitors.filter((monitor) => monitor.enabled)
  const maxListRows = Math.max(6, Math.floor(props.ctx.renderer.height * 0.45))
  return (
    <box flexDirection="column" width="100%" paddingX={2} paddingY={1}>
      <box flexDirection="row" width="100%" minWidth={0}>
        <text fg={palette().text} attributes={1} /* TextAttributes.BOLD */>Sourcefed monitors ({active.length})</text>
        <box flexGrow={1} />
        <text fg={palette().textMuted}>esc</text>
      </box>
      <Show when={active.length === 0} fallback={
        <scrollbox maxHeight={maxListRows} scrollY>
          <box flexDirection="column" width="100%">
            {active.map((monitor) => <MonitorCard monitor={monitor} tone={palette()} />)}
          </box>
        </scrollbox>
      }>
        <text fg={palette().textMuted}>No active monitors</text>
      </Show>
    </box>
  )
}

function MonitorCard(props: { monitor: MonitorView; tone: Tone }) {
  const monitor = props.monitor
  const palette = props.tone
  const status = monitor.unresponsive ? palette.error : monitor.enabled ? palette.success : palette.textMuted
  const statusLabel = !monitor.enabled ? "stopped" : monitor.unresponsive ? "recovering connection" : "healthy"
  const rows: Array<[string, string]> = [
    ["Delivery", monitor.delivery],
    ["Poll interval", `${monitor.pollIntervalSec}s`],
    ["Created", formatTime(monitor.createdAt)],
    ["Updated", formatTime(monitor.updatedAt)],
    ["Last poll", formatTime(monitor.lastPolledAt)],
    ["Webhook heartbeat", formatTime(monitor.webhookHeartbeatAt)],
  ]
  return (
    <box flexDirection="column" width="100%" minWidth={0} marginBottom={1}>
      <box flexDirection="row" width="100%" minWidth={0}>
        <text fg={status}>●</text>
        <text fg={palette.text}> {monitor.icon} {monitor.describe}</text>
        <text fg={status} flexGrow={1} flexShrink={1} minWidth={0} truncate> [{statusLabel}]</text>
      </box>
      {rows.map(([label, value]) => (
        <box flexDirection="row" width="100%" minWidth={0}>
          <text fg={palette.textMuted} flexShrink={0}>{label}: </text>
          <text fg={palette.text} flexGrow={1} flexShrink={1} minWidth={0} truncate>{value}</text>
        </box>
      ))}
    </box>
  )
}

function formatTime(value: string | undefined): string {
  if (!value) return "never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function LogsDialog(props: { ctx: Plugin.Context; logs: LogEntryView[] }) {
  const palette = createMemo(() => tone(props.ctx.theme))
  const maxListRows = Math.max(6, Math.floor(props.ctx.renderer.height * 0.45))
  return (
    <box flexDirection="column" width="100%" paddingX={2} paddingY={1}>
      <box flexDirection="row" width="100%" minWidth={0}>
        <text fg={palette().text} attributes={1} /* TextAttributes.BOLD */>Sourcefed notifications ({props.logs.length})</text>
        <box flexGrow={1} />
        <text fg={palette().textMuted}>esc</text>
      </box>
      <Show when={props.logs.length > 0} fallback={<text fg={palette().textMuted}>No notifications sent yet</text>}>
        <scrollbox maxHeight={maxListRows} scrollY stickyScroll stickyStart="bottom">
          <box flexDirection="column" width="100%">
            {props.logs.map((entry) => (
              <box flexDirection="column" width="100%">
                <box flexDirection="row" width="100%" minWidth={0}>
                  <text fg={entry.actionable ? palette().warning : palette().textMuted}>{entry.actionable ? "▶" : "·"}</text>
                  <text fg={palette().text} flexShrink={0} minWidth={0}> {entry.icon}</text>
                  <text fg={palette().text} flexGrow={1} flexShrink={1} minWidth={0} truncate> {new Date(entry.at).toLocaleString()} {entry.summary}</text>
                </box>
                <Show when={entry.body}>
                  <text fg={palette().textMuted}>  {entry.body}</text>
                </Show>
              </box>
            ))}
          </box>
        </scrollbox>
      </Show>
    </box>
  )
}
