import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { callMonitorTool } from "../tool-result.ts"

const definition: ToolDefinition = tool({
  description: "Stop a monitor created by the current session.",
  args: {
    id: tool.schema.string().describe("Monitor id (from monitor_list or monitor_create)"),
  },
  async execute(args, context) {
    return callMonitorTool("monitor_stop", { id: args.id }, context.sessionID)
  },
})

export default definition
