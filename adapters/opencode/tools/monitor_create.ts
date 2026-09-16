import { SOURCE_TYPES } from "@sourcefed/daemon"
import type { ToolContext } from "@opencode/plugin/promise/tool"
import { callMonitorTool } from "../tool-result.ts"

const definition = {
  name: "monitor_create",
  description:
    "Create a detect-only monitor that watches a Jira issue, GitHub PR, Slack thread, or Slack DM and routes NEW events into the current session. Slack monitors only read and notify; they never reply. GitHub and Slack use webhooks when configured and polling otherwise; Jira uses polling.",
  input: {
    type: "object",
    properties: {
      name: { type: "string", description: "Human-readable monitor name, e.g. 'PROJ-12345', 'PR #42'" },
      sourceType: { type: "string", enum: [...SOURCE_TYPES], description: "What to watch" },
      issueKey: { type: "string", description: "Jira issue key, e.g. PROJ-12345 (required if sourceType=jira)" },
      repo: { type: "string", description: "GitHub owner/name, e.g. owner/repository (required if sourceType=github)" },
      prNumber: { type: "number", description: "GitHub PR number (required if sourceType=github)" },
      channelId: { type: "string", description: "Slack channel or DM ID. A DM ID without threadTs monitors the whole DM conversation." },
      threadTs: { type: "string", description: "Slack parent message timestamp. Omit it with a DM ID to monitor the whole DM conversation." },
      threadUrl: { type: "string", description: "Slack thread URL (alternative to channelId + threadTs)" },
      pollIntervalSec: { type: "number", description: "Optional polling interval in seconds (min 15, default 60)" },
    },
    required: ["name", "sourceType"],
    additionalProperties: false,
  },
  async execute(input: unknown, context: ToolContext) {
    return { content: await callMonitorTool("monitor_create", (input ?? {}) as Record<string, unknown>, context.sessionID) }
  },
}

export default definition
