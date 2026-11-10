/** @jsxImportSource @opentui/solid */

import { createMemo, createSignal, Show } from "solid-js"
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

  const monitorTarget = (id: string) => ({ target: { kind: "opencode-session", id } })

  const listMonitors = async (sessionID: string): Promise<MonitorView[]> => {
    const result = (await (await getClient()).request("monitor.list", monitorTarget(sessionID))) as { monitors?: MonitorView[] }
    return result?.monitors ?? []
  }

  // Runs stop, start or remove the way the agent's tools do; the daemon answers
  // { ok: false, error } for a monitor it refuses.
  const runAction = async (sessionID: string, action: MonitorAction, id: string): Promise<void> => {
    const result = (await (await getClient()).request(`monitor.${action}`, { ...monitorTarget(sessionID), id })) as { ok?: boolean; error?: string }
    if (result?.ok === false) throw new Error(result.error ?? `monitor ${action} failed`)
  }

  const showMonitors = async (sessionID: string, focusIndex = 0): Promise<void> => {
    const monitors = await listMonitors(sessionID)
    ctx.ui.dialog.set({ size: "large" })
    ctx.ui.dialog.show(() => (
      <MonitorDialog
        ctx={ctx}
        monitors={monitors}
        focusIndex={focusIndex}
        toggle={async (monitor) => {
          await runAction(sessionID, monitor.enabled ? "stop" : "start", monitor.id)
          return listMonitors(sessionID)
        }}
        remove={(monitor, index) => void confirmRemove(sessionID, monitor, index)}
      />
    ))
  }

  // The confirmation replaces the monitors dialog, so the list reopens afterwards.
  const confirmRemove = async (sessionID: string, monitor: MonitorView, index: number): Promise<void> => {
    try {
      const confirmed = await ctx.ui.dialog.confirm({
        title: "Delete monitor",
        message: `Delete ${monitor.describe}? It stops watching and its record is removed.`,
        label: { confirm: "Delete", cancel: "Cancel" },
      })
      if (confirmed) {
        await runAction(sessionID, "remove", monitor.id)
        ctx.ui.toast.show({ variant: "success", message: `Deleted ${monitor.name}` })
      }
      await showMonitors(sessionID, index)
    } catch (error) {
      ctx.ui.toast.show({ variant: "error", message: `Sourcefed: ${errorMessage(error)}` })
    }
  }

  const disposeSlot = ctx.ui.slot({
    append: "sidebar.content",
    render: ({ sessionID }) => <Sidebar ctx={ctx} sessionID={sessionID} />,
  })

  const disposeKeymapSlot = ctx.ui.slot({
    append: "app",
    render: () => <KeymapRegistration ctx={ctx} currentSessionID={currentSessionID} getClient={getClient} showMonitors={showMonitors} />,
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
  showMonitors: (sessionID: string) => Promise<void>
}) {
  const { ctx, currentSessionID, getClient, showMonitors } = props

  ctx.keymap.layer(() => ({
    mode: "global",
    commands: [
      {
        id: "sourcefed",
        title: "Sourcefed monitors",
        description: "Show, stop, start, or delete monitors for the current OpenCode session",
        slash: { name: "sourcefed" },
        run: async () => {
          const id = currentSessionID()

          if (!id) {
            ctx.ui.toast.show({ variant: "warning", message: "No active OpenCode session" })
            return
          }

          try {
            await showMonitors(id)
          } catch (error) {
            ctx.ui.toast.show({ variant: "error", message: `Sourcefed daemon unavailable: ${errorMessage(error)}` })
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
            ctx.ui.toast.show({ variant: "error", message: `Sourcefed daemon unavailable: ${errorMessage(error)}` })
          }
        },
      },
    ],
  }))

  return null
}

type MonitorAction = "stop" | "start" | "remove"

const DIALOG_LAYER_PRIORITY = 100

function MonitorDialog(props: {
  ctx: Plugin.Context
  monitors: MonitorView[]
  focusIndex: number
  toggle: (monitor: MonitorView) => Promise<MonitorView[]>
  remove: (monitor: MonitorView, index: number) => void
}) {
  const palette = createMemo(() => tone(props.ctx.theme))
  const [monitors, setMonitors] = createSignal(props.monitors)
  const [selected, setSelected] = createSignal(clampIndex(props.focusIndex, props.monitors.length))
  const [busy, setBusy] = createSignal<string>()
  const [error, setError] = createSignal<string>()
  const active = createMemo(() => monitors().filter((monitor) => monitor.enabled).length)
  const maxListRows = Math.max(6, Math.floor(props.ctx.renderer.height * 0.45))

  const move = (delta: number) => setSelected((index) => clampIndex(index + delta, monitors().length))
  const current = () => (busy() ? undefined : monitors()[selected()])

  const toggle = async (monitor: MonitorView) => {
    setError(undefined)
    setBusy(`${monitor.enabled ? "Stopping" : "Starting"} ${monitor.name}…`)
    try {
      const next = await props.toggle(monitor)
      setMonitors(next)
      const kept = next.findIndex((candidate) => candidate.id === monitor.id)
      setSelected(clampIndex(kept >= 0 ? kept : selected(), next.length))
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(undefined)
    }
  }

  // Owned by this dialog: the keys exist only while it is open.
  props.ctx.keymap.layer(() => ({
    mode: "global",
    priority: DIALOG_LAYER_PRIORITY,
    commands: [
      { title: "Previous monitor", bind: "up", run: () => move(-1) },
      { title: "Next monitor", bind: "down", run: () => move(1) },
      { title: "Stop or start monitor", bind: "s", run: () => { const monitor = current(); if (monitor) void toggle(monitor) } },
      { title: "Delete monitor", bind: "d", run: () => { const monitor = current(); if (monitor) props.remove(monitor, selected()) } },
    ],
  }))

  return (
    <box flexDirection="column" width="100%" paddingX={2} paddingY={1}>
      <box flexDirection="row" width="100%" minWidth={0}>
        <text fg={palette().text} attributes={1} /* TextAttributes.BOLD */>Sourcefed monitors ({active()} active)</text>
        <box flexGrow={1} />
        <text fg={palette().textMuted}>esc</text>
      </box>
      <Show when={monitors().length > 0} fallback={<text fg={palette().textMuted}>No monitors</text>}>
        <scrollbox maxHeight={maxListRows} scrollY>
          <box flexDirection="column" width="100%">
            {monitors().map((monitor, index) => <MonitorCard monitor={monitor} tone={palette()} selected={index === selected()} />)}
          </box>
        </scrollbox>
      </Show>
      <Show when={error()}>
        <text fg={palette().error}>{error()}</text>
      </Show>
      <text fg={palette().textMuted}>{busy() ?? "↑↓ select · s stop/start · d delete · esc close"}</text>
    </box>
  )
}

function MonitorCard(props: { monitor: MonitorView; tone: Tone; selected: boolean }) {
  const monitor = props.monitor
  const palette = props.tone
  const status = !monitor.enabled ? palette.textMuted : monitor.unresponsive ? palette.error : palette.success
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
    <box flexDirection="column" width="100%" minWidth={0} marginBottom={props.selected ? 1 : 0}>
      <box flexDirection="row" width="100%" minWidth={0}>
        <box width={2} flexShrink={0}>
          <text fg={palette.accent}>{props.selected ? "›" : ""}</text>
        </box>
        <text fg={status}>●</text>
        <text fg={palette.text}> {monitor.icon} {monitor.describe}</text>
        <text fg={status} flexGrow={1} flexShrink={1} minWidth={0} truncate> [{statusLabel}]</text>
      </box>
      <Show when={props.selected}>
        {rows.map(([label, value]) => (
          <box flexDirection="row" width="100%" minWidth={0} paddingLeft={4}>
            <text fg={palette.textMuted} flexShrink={0}>{label}: </text>
            <text fg={palette.text} flexGrow={1} flexShrink={1} minWidth={0} truncate>{value}</text>
          </box>
        ))}
      </Show>
    </box>
  )
}

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), Math.max(length - 1, 0))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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
