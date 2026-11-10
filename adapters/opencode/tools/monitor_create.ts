import { SOURCE_TYPES } from "@sourcefed/daemon"
import type { ToolContext } from "@opencode/plugin/promise/tool"
import { callMonitorTool } from "../tool-result.ts"
import type { OpenCodeBridge } from "../bridge.ts"

export default (bridge: OpenCodeBridge) => ({
  name: "monitor_create",
  description:
    "Create a detect-only monitor that watches a Jira issue, GitHub PR, Slack thread, Slack DM, or a feed read through Yab (the user's browser, with their sign-ins) and routes NEW events into the current session. Slack monitors only read and notify; they never reply. GitHub and Slack use webhooks when configured and polling otherwise; Jira and Yab use polling.",
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
      url: { type: "string", description: "Atom, RSS or JSON feed URL read through Yab with the user's sign-ins, e.g. https://mail.google.com/mail/u/0/feed/atom (required if sourceType=yab)" },
      space: { type: "string", description: "Yab space whose sign-ins to use (yab); omit to use wherever the site is signed in" },
      match: { type: "string", description: "Case-insensitive regex; only entries whose title, summary or author match are delivered (yab)" },
      exclude: { type: "string", description: "Case-insensitive regex; entries that match are skipped (yab)" },
      pollIntervalSec: { type: "number", description: "Optional polling interval in seconds (min 15, default 60)" },
    },
    required: ["name", "sourceType"],
    additionalProperties: false,
  },
  async execute(input: unknown, context: ToolContext) {
    return { content: await callMonitorTool(bridge, "monitor_create", (input ?? {}) as Record<string, unknown>, context.sessionID) }
  },
})
