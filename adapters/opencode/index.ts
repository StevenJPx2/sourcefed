import type { Plugin, Hooks } from "@opencode-ai/plugin"
import { OpenCodeBridge, setOpenCodeBridge } from "./bridge.ts"
import monitorCreate from "./tools/monitor_create.ts"
import monitorList from "./tools/monitor_list.ts"
import monitorStatus from "./tools/monitor_status.ts"
import monitorStop from "./tools/monitor_stop.ts"

export const Sourcefed: Plugin = async (input) => {
  const bridge = new OpenCodeBridge(input.client)
  setOpenCodeBridge(bridge)
  await bridge.start()

  const hooks: Hooks = {
    dispose: () => {
      return bridge.close()
    },
    tool: {
      monitor_create: monitorCreate,
      monitor_list: monitorList,
      monitor_status: monitorStatus,
      monitor_stop: monitorStop,
    },
  }
  return hooks
}

export default Sourcefed
