import { Plugin } from "@opencode/plugin"
import { OpenCodeBridge, setOpenCodeBridge } from "./bridge.ts"
import monitorCreate from "./tools/monitor_create.ts"
import monitorList from "./tools/monitor_list.ts"
import monitorStatus from "./tools/monitor_status.ts"
import monitorStart from "./tools/monitor_start.ts"
import monitorStop from "./tools/monitor_stop.ts"

// Shared setup: starts the daemon bridge and registers the monitor tools.
// Reused by the published `./server` entry, which layers guidance on top.
export async function setupSourcefed(ctx: Plugin.Context): Promise<Plugin.Cleanup> {
  const bridge = new OpenCodeBridge(ctx.session, ctx.rpc)
  setOpenCodeBridge(bridge)
  await bridge.start()

  await ctx.tool.transform((editor) => {
    editor.add(monitorCreate)
    editor.add(monitorList)
    editor.add(monitorStatus)
    editor.add(monitorStart)
    editor.add(monitorStop)
  })

  return () => bridge.close()
}

export default Plugin.define({
  id: "sourcefed",
  setup: setupSourcefed,
})
