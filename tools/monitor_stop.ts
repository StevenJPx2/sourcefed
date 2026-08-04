import { tool } from "@opencode-ai/plugin"
import { getMonitor, stopMonitor } from "#sourcefed/monitors"

export default tool({
  description: "Stop a monitor created by the current session.",
  args: {
    id: tool.schema.string().describe("Monitor id (from monitor_list or monitor_create)"),
  },
  async execute(args, context) {
    const existing = await getMonitor(args.id)
    if (!existing || existing.sessionID !== context.sessionID) return JSON.stringify({ error: `no monitor ${args.id}` })
    const m = await stopMonitor(args.id)
    if ("error" in m) return JSON.stringify({ error: m.error })
    return JSON.stringify({ ok: true, monitorId: m.id, stopped: !m.enabled })
  },
})
