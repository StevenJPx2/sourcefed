import type { TuiPluginModule } from "@opencode-ai/plugin/tui"
import { connectDaemonClient, defaultDaemonUrl, type DaemonClient } from "@sourcefed/daemon"

const sourcefedTui: TuiPluginModule["tui"] = async (api) => {
  let client: DaemonClient | undefined

  const unregister = api.command?.register(() => [{
    value: "sourcefed",
    title: "Sourcefed monitors",
    description: "Show monitors for the current OpenCode session",
    slash: { name: "sourcefed" },
    onSelect: async (dialog) => {
      const currentRoute = api.route.current
      const sessionID = "params" in currentRoute && typeof currentRoute.params?.sessionID === "string" ? currentRoute.params.sessionID : undefined
      if (!sessionID) {
        api.ui.toast({ variant: "warning", message: "No active OpenCode session" })
        return
      }
      const url = process.env.SOURCEFED_DAEMON_URL ?? defaultDaemonUrl()
      client ??= await connectDaemonClient({
        name: "sourcefed-opencode-tui",
        url,
      })
      const result = await client.request("monitor.list", { target: { kind: "opencode-session", id: sessionID } })
      const message = JSON.stringify(result, null, 2)
      dialog?.replace(() => api.ui.DialogAlert({ title: "Sourcefed monitors", message, onConfirm: () => dialog.clear() }))
    },
  }])

  void unregister
}

export default {
  id: "sourcefed-tui",
  tui: sourcefedTui,
}
