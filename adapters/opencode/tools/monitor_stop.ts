import type { ToolContext } from "@opencode/plugin/promise/tool"
import { callMonitorTool } from "../tool-result.ts"
import type { OpenCodeBridge } from "../bridge.ts"

export default (bridge: OpenCodeBridge) => ({
  name: "monitor_stop",
  description: "Stop a monitor created by the current session.",
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
    return { content: await callMonitorTool(bridge, "monitor_stop", { id: args.id }, context.sessionID) }
  },
})
