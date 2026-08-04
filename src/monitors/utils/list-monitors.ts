import type { MonitorRecord } from "../types"
import { loadMonitors } from "./load-monitors.ts"

export async function listMonitors(): Promise<MonitorRecord[]> {
  const registry = await loadMonitors()
  return registry.monitors
}
