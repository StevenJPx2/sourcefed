import { tool } from "@opencode-ai/plugin"
import { callMonitorTool } from "../tool-result.ts"

export default tool({
  description: "Start (re-enable) a stopped monitor created by the current session.",
  args: {
    id: tool.schema.string().describe("Monitor id (from monitor_list or monitor_create)"),
  },
  async execute(args, context) {
    return callMonitorTool("monitor_start", { id: args.id }, context.sessionID)
  },
})
