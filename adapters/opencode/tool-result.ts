import type { OpenCodeBridge } from "./bridge.ts"

export async function callMonitorTool(bridge: OpenCodeBridge, name: string, arguments_: Record<string, unknown>, sessionID: string): Promise<string> {
  const result = await bridge.callTool(name, arguments_, sessionID)
  return JSON.stringify(result)
}
