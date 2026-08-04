import { tool } from "@opencode-ai/plugin"
import { getMonitor } from "#sourcefed/monitors"

export default tool({
  description: "Get the status of a monitor created by the current session.",
  args: {
    id: tool.schema.string().describe("Monitor id (from monitor_list or monitor_create)"),
  },
  async execute(args, context) {
    const m = await getMonitor(args.id)
    if (!m || m.sessionID !== context.sessionID) return JSON.stringify({ error: `no monitor ${args.id}` })
    return JSON.stringify({
      id: m.id,
      name: m.name,
      source: m.source,
      delivery: m.delivery,
      enabled: m.enabled,
      sessionID: m.sessionID,
      pollIntervalSec: m.pollIntervalSec,
      cursors: m.cursors,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    })
  },
})
