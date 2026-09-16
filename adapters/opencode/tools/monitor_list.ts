import type { ToolContext } from "@opencode/plugin/promise/tool"
import { callMonitorTool } from "../tool-result.ts"

const definition = {
  name: "monitor_list",
  description: "List monitors created by the current session (id, name, source, delivery, enabled).",
  input: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  async execute(_input: unknown, context: ToolContext) {
    return { content: await callMonitorTool("monitor_list", {}, context.sessionID) }
  },
}

export default definition
