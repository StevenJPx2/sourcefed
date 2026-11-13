import { monitorCreateToolSchema, toDaemonCreateInput } from "@sourcefed/daemon"
import type { ToolContext } from "@opencode/plugin/promise/tool"
import { callMonitorTool } from "../tool-result.ts"
import type { OpenCodeBridge } from "../bridge.ts"

export default (bridge: OpenCodeBridge) => ({
  name: "monitor_create",
  description:
    "Create a detect-only monitor that watches a Jira issue, GitHub PR, GitHub issues with labels, Slack thread, Slack DM, or a feed read through Yab (the user's browser, with their sign-ins) and routes NEW events into the current session. Pick one source by its type and give only that source's fields. Slack monitors only read and notify; they never reply. GitHub and Slack use webhooks when configured and polling otherwise; Jira and Yab use polling.",
  input: monitorCreateToolSchema(),
  async execute(input: unknown, context: ToolContext) {
    const request = toDaemonCreateInput(input) as unknown as Record<string, unknown>
    return { content: await callMonitorTool(bridge, "monitor_create", request, context.sessionID) }
  },
})
