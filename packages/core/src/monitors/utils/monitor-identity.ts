import type { MonitorSource } from "#sourcefed/sources"
import type { MonitorTarget } from "#sourcefed/types"
import type { MonitorRecord } from "../types"

function monitorSourceIdentity(source: MonitorSource): string {
  return JSON.stringify(source)
}

export function monitorIdentity(target: MonitorTarget, source: MonitorSource): string {
  return JSON.stringify([target.kind, target.id, monitorSourceIdentity(source)])
}

export function dedupeActiveMonitors(monitors: MonitorRecord[]): MonitorRecord[] {
  const seen = new Set<string>()
  const result: MonitorRecord[] = []

  for (const monitor of monitors) {
    if (!monitor.enabled) {
      result.push(monitor)
      continue
    }

    const identity = monitorIdentity(monitor.target, monitor.source)
    if (seen.has(identity)) continue

    seen.add(identity)
    result.push(monitor)
  }

  return result
}
