import type { TuiPluginModule } from "@opencode-ai/plugin/tui"
import { connectSourcefedClient, parseToolResult } from "@sourcefed/mcp"

const sourcefedTui: TuiPluginModule["tui"] = async (api) => {
  let client: Awaited<ReturnType<typeof connectSourcefedClient>> | undefined

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
      if (!process.env.SOURCEFED_MCP_URL) {
        api.ui.toast({ variant: "warning", message: "Set SOURCEFED_MCP_URL to use the Sourcefed TUI" })
        return
      }
      client ??= await connectSourcefedClient({ name: "sourcefed-opencode-tui", url: process.env.SOURCEFED_MCP_URL })
      const result = parseToolResult(await client.callTool({
        name: "monitor_list",
        arguments: { target: { kind: "opencode-session", id: sessionID } },
      }))
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
