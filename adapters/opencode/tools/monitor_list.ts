import type { ToolContext } from "@opencode/plugin/promise/tool"
import { callMonitorTool } from "../tool-result.ts"
import type { OpenCodeBridge } from "../bridge.ts"

export default (bridge: OpenCodeBridge) => ({
  name: "monitor_list",
  description: "List monitors created by the current session (id, name, source, delivery, enabled).",
  input: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  async execute(_input: unknown, context: ToolContext) {
    return { content: await callMonitorTool(bridge, "monitor_list", {}, context.sessionID) }
  },
})
