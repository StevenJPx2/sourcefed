import type { TuiPluginApi } from "@opencode-ai/plugin/tui"

export function currentSessionID(api: TuiPluginApi): string | undefined {
  const route = api.route.current
  if (route.name !== "session") return undefined
  if (typeof route.params?.sessionID !== "string") return undefined
  return route.params.sessionID
}
