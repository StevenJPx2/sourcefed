import { tool } from "@opencode-ai/plugin"
import { createMonitor } from "#sourcefed/monitors"
import { sourceDefinition, sourceForInput } from "#sourcefed/source-utils"
import { ensurePollLoop } from "../src/monitors/poll/utils"
import { getClient } from "../src/client"
import { ensureWebhookServer } from "../src/monitors/webhook/utils"

export default tool({
  description:
    "Create a detect-only monitor that watches a Jira issue, GitHub PR, or Slack thread and routes NEW events into the current session. Slack monitors only read and notify; they never reply. GitHub and Slack use webhooks when configured and polling otherwise; Jira uses polling.",
  args: {
    name: tool.schema.string().describe("Human-readable monitor name, e.g. 'PROJ-12345', 'PR #42'"),
    sourceType: tool.schema.enum(["jira", "github", "slack"]).describe("What to watch"),
    issueKey: tool.schema.string().describe("Jira issue key, e.g. PROJ-12345 (required if sourceType=jira)").optional(),
    repo: tool.schema.string().describe("GitHub owner/name, e.g. owner/repository (required if sourceType=github)").optional(),
    prNumber: tool.schema.number().describe("GitHub PR number (required if sourceType=github)").optional(),
    channelId: tool.schema.string().describe("Slack channel or DM ID (use with threadTs for sourceType=slack)").optional(),
    threadTs: tool.schema.string().describe("Slack parent message timestamp (use with channelId for sourceType=slack)").optional(),
    threadUrl: tool.schema.string().describe("Slack thread URL (alternative to channelId + threadTs)").optional(),
    pollIntervalSec: tool.schema.number().describe("Optional polling interval in seconds (min 15, default 60)").optional(),
  },
  async execute(args, context) {
    const source = sourceForInput(args.sourceType, args)
    if ("error" in source) return JSON.stringify({ error: source.error })
    const definition = sourceDefinition(source)
    const delivery = sourceDefinition(source).initialDelivery(source)

    const m = await createMonitor({
      name: args.name,
      source,
      delivery,
      sessionID: context.sessionID,
      pollIntervalSec: args.pollIntervalSec ?? 60,
    })

    ensurePollLoop(getClient())
    ensureWebhookServer(getClient())

    return JSON.stringify({
      ok: true,
      monitor: {
        id: m.id,
        name: m.name,
        source: m.source,
        delivery: m.delivery,
        pollIntervalSec: m.pollIntervalSec,
        sessionID: m.sessionID,
      },
       hint: `Monitor ${m.id} created. ${definition.deliveryHint(m.delivery)} Stop it with the monitor_stop tool.`,
    })
  },
})
