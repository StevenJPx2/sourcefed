import type { MonitorContext } from "#sourcefed/types"
import type { Monitor } from "../../monitor"

/** Mark every enabled monitor that wakes on this verified delivery, so its next tick polls. */
export async function wakeMonitors(context: MonitorContext, path: string, payload: unknown, eventName: string): Promise<number> {
  let woken = 0
  for (const record of await context.service.list()) {
    if (!record.enabled) continue

    const monitor = context.sources[record.source.type] as Monitor | undefined
    if (!monitor?.wake || monitor.wake.path !== path) continue
    if (!monitor.wake.matches(monitor.validateSource(record.source), payload, eventName)) continue

    await context.service.updateCursor(record, "__wakeAt", Date.now())
    woken += 1
  }
  return woken
}
