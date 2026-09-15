import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { SOURCE_TYPES } from "@sourcefed/daemon"
import { callMonitorTool } from "../tool-result.ts"

const definition: ToolDefinition = tool({
  description:
    "Create a detect-only monitor that watches a Jira issue, GitHub PR, Slack thread, or Slack DM and routes NEW events into the current session. Slack monitors only read and notify; they never reply. GitHub and Slack use webhooks when configured and polling otherwise; Jira uses polling.",
  args: {
    name: tool.schema.string().describe("Human-readable monitor name, e.g. 'PROJ-12345', 'PR #42'"),
    sourceType: tool.schema.enum(SOURCE_TYPES).describe("What to watch"),
    issueKey: tool.schema.string().describe("Jira issue key, e.g. PROJ-12345 (required if sourceType=jira)").optional(),
    repo: tool.schema.string().describe("GitHub owner/name, e.g. owner/repository (required if sourceType=github)").optional(),
    prNumber: tool.schema.number().describe("GitHub PR number (required if sourceType=github)").optional(),
    channelId: tool.schema.string().describe("Slack channel or DM ID. A DM ID without threadTs monitors the whole DM conversation.").optional(),
    threadTs: tool.schema.string().describe("Slack parent message timestamp. Omit it with a DM ID to monitor the whole DM conversation.").optional(),
    threadUrl: tool.schema.string().describe("Slack thread URL (alternative to channelId + threadTs)").optional(),
    pollIntervalSec: tool.schema.number().describe("Optional polling interval in seconds (min 15, default 60)").optional(),
  },
  async execute(args, context) {
    return callMonitorTool("monitor_create", args, context.sessionID)
  },
})

export default definition
