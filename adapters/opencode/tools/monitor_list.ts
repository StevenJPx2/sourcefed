import { tool } from "@opencode-ai/plugin"
import { callMonitorTool } from "../tool-result.ts"

export default tool({
  description: "List monitors created by the current session (id, name, source, delivery, enabled).",
  args: {},
  async execute(_args, context) {
    return callMonitorTool("monitor_list", {}, context.sessionID)
  },
})
