import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { openMonitorDialog } from "./open-monitor-dialog"

export function registerCommand(api: TuiPluginApi): void {
  api.keymap.registerLayer({
    commands: [
      {
        namespace: "palette",
        name: "sourcefed.monitors",
        title: "Sourcefed: Monitors",
        category: "Sourcefed",
        slashName: "sourcefed",
        run: () => openMonitorDialog(api),
      },
    ],
    bindings: [],
  })
}
