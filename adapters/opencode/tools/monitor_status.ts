import { tool } from "@opencode-ai/plugin"
import { callMonitorTool } from "../tool-result.ts"

export default tool({
  description: "Get the status of a monitor created by the current session.",
  args: {
    id: tool.schema.string().describe("Monitor id (from monitor_list or monitor_create)"),
  },
  async execute(args, context) {
    return callMonitorTool("monitor_status", { id: args.id }, context.sessionID)
  },
})
