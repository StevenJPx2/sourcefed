import { getOpenCodeBridge } from "./bridge.ts"

export async function callMonitorTool(name: string, arguments_: Record<string, unknown>, sessionID: string): Promise<string> {
  const result = await getOpenCodeBridge().callTool(name, arguments_, sessionID)
  return JSON.stringify(result)
}
