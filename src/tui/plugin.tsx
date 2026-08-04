/** @jsxImportSource @opentui/solid */

import type { TuiPlugin, TuiPluginApi, TuiSlotPlugin } from "@opencode-ai/plugin/tui"
import { registerCommand } from "./register-command"
import { Sidebar } from "./sidebar"

export const sourcefedTui: TuiPlugin = async (api: TuiPluginApi) => {
  const sidebar: TuiSlotPlugin = {
    order: 190,
    slots: {
      sidebar_content: (_context, value) => <Sidebar api={api} sessionID={value.session_id} />,
    },
  }
  api.slots.register(sidebar)
  registerCommand(api)
}
