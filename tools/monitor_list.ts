import { tool } from "@opencode-ai/plugin"
import { listMonitors } from "#sourcefed/monitors"

export default tool({
  description: "List monitors created by the current session (id, name, source, delivery, enabled).",
  args: {},
  async execute(_args, context) {
    const monitors = (await listMonitors()).filter((monitor) => monitor.sessionID === context.sessionID)
    const entries = monitors.map((m) => ({
      id: m.id,
      name: m.name,
      source: m.source,
      delivery: m.delivery,
      enabled: m.enabled,
      pollIntervalSec: m.pollIntervalSec,
      createdAt: m.createdAt,
    }))
    if (entries.length === 0) {
      return JSON.stringify({
        monitors: entries,
        hint: "No monitors created yet. Use monitor_create to watch a Jira issue or GitHub PR.",
      })
    }
    return JSON.stringify({ monitors: entries })
  },
})
