import { tool } from "@opencode-ai/plugin"
import { SOURCE_TYPES } from "@sourcefed/daemon"
import { callMonitorTool } from "../tool-result.ts"

export default tool({
  description:
    "Create a detect-only monitor that watches a Jira issue, GitHub PR, or Slack thread and routes NEW events into the current session. Slack monitors only read and notify; they never reply. GitHub and Slack use webhooks when configured and polling otherwise; Jira uses polling.",
  args: {
    name: tool.schema.string().describe("Human-readable monitor name, e.g. 'PROJ-12345', 'PR #42'"),
    sourceType: tool.schema.enum(SOURCE_TYPES).describe("What to watch"),
    issueKey: tool.schema.string().describe("Jira issue key, e.g. PROJ-12345 (required if sourceType=jira)").optional(),
    repo: tool.schema.string().describe("GitHub owner/name, e.g. owner/repository (required if sourceType=github)").optional(),
    prNumber: tool.schema.number().describe("GitHub PR number (required if sourceType=github)").optional(),
    channelId: tool.schema.string().describe("Slack channel or DM ID (use with threadTs for sourceType=slack)").optional(),
    threadTs: tool.schema.string().describe("Slack parent message timestamp (use with channelId for sourceType=slack)").optional(),
    threadUrl: tool.schema.string().describe("Slack thread URL (alternative to channelId + threadTs)").optional(),
    pollIntervalSec: tool.schema.number().describe("Optional polling interval in seconds (min 15, default 60)").optional(),
  },
  async execute(args, context) {
    return callMonitorTool("monitor_create", args, context.sessionID)
  },
})
