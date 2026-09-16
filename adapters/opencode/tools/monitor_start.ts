import type { ToolContext } from "@opencode/plugin/promise/tool"
import { callMonitorTool } from "../tool-result.ts"

const definition = {
  name: "monitor_start",
  description: "Start (re-enable) a stopped monitor created by the current session.",
  input: {
    type: "object",
    properties: {
      id: { type: "string", description: "Monitor id (from monitor_list or monitor_create)" },
    },
    required: ["id"],
    additionalProperties: false,
  },
  async execute(input: unknown, context: ToolContext) {
    const args = (input ?? {}) as { id?: string }
    return { content: await callMonitorTool("monitor_start", { id: args.id }, context.sessionID) }
  },
}

export default definition
