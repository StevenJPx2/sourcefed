import type { TuiPluginModule } from "@opencode-ai/plugin/tui"
import { sourcefedTui } from "./tui/plugin.tsx"

const tui: TuiPluginModule["tui"] = sourcefedTui

export default {
  id: "sourcefed-tui",
  tui,
}
