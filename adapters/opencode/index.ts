import { Plugin } from "@opencode/plugin"
import { OpenCodeBridge } from "./bridge.ts"
import monitorCreate from "./tools/monitor_create.ts"
import monitorList from "./tools/monitor_list.ts"
import monitorStatus from "./tools/monitor_status.ts"
import monitorStart from "./tools/monitor_start.ts"
import monitorStop from "./tools/monitor_stop.ts"

// Shared setup: starts the daemon bridge and registers the monitor tools.
// Reused by the published `./server` entry, which layers guidance on top.
export async function setupSourcefed(ctx: Plugin.Context): Promise<Plugin.Cleanup> {
  const bridge = new OpenCodeBridge(ctx.session, ctx.rpc, ctx.location)
  try {
    await bridge.start()
    await ctx.tool.transform((editor) => {
      editor.add(monitorCreate(bridge))
      editor.add(monitorList(bridge))
      editor.add(monitorStatus(bridge))
      editor.add(monitorStart(bridge))
      editor.add(monitorStop(bridge))
    })
  } catch (error) {
    await bridge.close()
    throw error
  }

  return () => bridge.close()
}

export default Plugin.define({
  id: "sourcefed",
  setup: setupSourcefed,
})
