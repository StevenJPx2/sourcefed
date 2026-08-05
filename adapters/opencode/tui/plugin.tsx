/** @jsxImportSource @opentui/solid */

import { createMemo, createSignal, Show } from "solid-js"
import type { TuiPlugin, TuiPluginApi, TuiThemeCurrent } from "@opencode-ai/plugin/tui"
import { connectDaemonClient, defaultDaemonUrl, type DaemonClient, type LogEntryView, type MonitorView } from "@sourcefed/daemon"
import { Sidebar } from "./sidebar.tsx"

export const sourcefedTui: TuiPlugin = async (api: TuiPluginApi) => {
  api.slots.register({
    order: 190,
    slots: {
      sidebar_content: (_context, value) => <Sidebar api={api} sessionID={value.session_id} />,
    },
  })

  let client: DaemonClient | undefined

  const getSessionID = (): string | undefined => {
    const currentRoute = api.route.current
    return "params" in currentRoute && typeof currentRoute.params?.sessionID === "string" ? currentRoute.params.sessionID : undefined
  }

  const getClient = async (): Promise<DaemonClient | undefined> => {
    if (client) return client
    client = await connectDaemonClient({
      name: "sourcefed-opencode-tui",
      url: process.env.SOURCEFED_DAEMON_URL ?? defaultDaemonUrl(),
    })
    return client
  }

  const unregister = api.command?.register(() => [
    {
      value: "sourcefed",
      title: "Sourcefed monitors",
      description: "Show monitors for the current OpenCode session",
      slash: { name: "sourcefed" },
      onSelect: async (dialog) => {
        const sessionID = getSessionID()
        if (!sessionID) {
          api.ui.toast({ variant: "warning", message: "No active OpenCode session" })
          return
        }
        try {
          const daemon = await getClient()
          if (!daemon) throw new Error("no daemon client")
          const result = (await daemon.request("monitor.list", { target: { kind: "opencode-session", id: sessionID } })) as { monitors?: MonitorView[] }
          const monitors = result?.monitors ?? []
          api.ui.dialog.replace(() => <MonitorDialog api={api} monitors={monitors} />)
          api.ui.dialog.setSize("large")
        } catch (error) {
          api.ui.toast({ variant: "error", message: `Sourcefed daemon unavailable: ${error instanceof Error ? error.message : String(error)}` })
        }
      },
    },
    {
      value: "sourcefed logs",
      title: "Sourcefed logs",
      description: "Show recent Sourcefed notifications for the current OpenCode session",
      slash: { name: "sourcefed logs" },
      onSelect: async (dialog) => {
        const sessionID = getSessionID()
        if (!sessionID) {
          api.ui.toast({ variant: "warning", message: "No active OpenCode session" })
          return
        }
        try {
          const daemon = await getClient()
          if (!daemon) throw new Error("no daemon client")
          const result = (await daemon.request("monitor.logs", { target: { kind: "opencode-session", id: sessionID } })) as { logs?: LogEntryView[] }
          const logs = result?.logs ?? []
          api.ui.dialog.replace(() => <LogsDialog api={api} logs={logs} />)
          api.ui.dialog.setSize("large")
        } catch (error) {
          api.ui.toast({ variant: "error", message: `Sourcefed daemon unavailable: ${error instanceof Error ? error.message : String(error)}` })
        }
      },
    },
  ])

  void unregister
}

function MonitorDialog(props: { api: TuiPluginApi; monitors: MonitorView[] }) {
  const theme = createMemo(() => (props.api as unknown as { theme: { current: TuiThemeCurrent } }).theme.current)
  return (
    <box flexDirection="column" width="100%">
      <text fg={theme().accent}>Sourcefed monitors ({props.monitors.length})</text>
      <Show when={props.monitors.length === 0} fallback={
        <box flexDirection="column" width="100%">
          {props.monitors.map((monitor) => (
            <box flexDirection="row" width="100%">
              <text fg={monitor.enabled ? theme().success : theme().textMuted}>{monitor.enabled ? "●" : "○"} </text>
              <text fg={theme().text}>{monitor.icon} {monitor.describe}</text>
              <text fg={theme().textMuted}>{monitor.detail}</text>
            </box>
          ))}
        </box>
      }>
        <text fg={theme().textMuted}>No active monitors</text>
      </Show>
    </box>
  )
}

function LogsDialog(props: { api: TuiPluginApi; logs: LogEntryView[] }) {
  const theme = createMemo(() => (props.api as unknown as { theme: { current: TuiThemeCurrent } }).theme.current)
  return (
    <box flexDirection="column" width="100%">
      <text fg={theme().accent}>Sourcefed notifications ({props.logs.length})</text>
      <Show when={props.logs.length > 0} fallback={<text fg={theme().textMuted}>No notifications sent yet</text>}>
        <box flexDirection="column" width="100%">
          {props.logs.map((entry) => (
            <box flexDirection="column" width="100%">
              <box flexDirection="row" width="100%">
                <text fg={entry.actionable ? theme().warning : theme().textMuted}>{entry.actionable ? "▶" : "·"} </text>
                <text fg={theme().text}>{entry.icon} {new Date(entry.at).toLocaleString()} {entry.summary}</text>
              </box>
              <Show when={entry.body}>
                <text fg={theme().textMuted}>  {entry.body}</text>
              </Show>
            </box>
          ))}
        </box>
      </Show>
    </box>
  )
}
