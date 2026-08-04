import type { MonitorRecord } from "../types"
import { loadMonitors } from "./load-monitors.ts"

export async function getMonitor(id: string): Promise<MonitorRecord | undefined> {
  const registry = await loadMonitors()
  return registry.monitors.find((monitor) => monitor.id === id)
}
