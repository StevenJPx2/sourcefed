import type { MonitorEvent } from "./monitor-event.ts"
import type { MonitorTarget } from "./monitor-target.ts"
import type { MonitorRecord } from "../monitors/types/monitor-record.ts"

export type QueuedMonitorEvent = {
  id: string
  monitorID: string
  target: MonitorTarget
  event: MonitorEvent
  queuedAt: string
}

export interface MonitorEventQueue {
  enqueue(input: { monitor: MonitorRecord; event: MonitorEvent }): Promise<QueuedMonitorEvent>
  read(target: MonitorTarget): Promise<QueuedMonitorEvent[]>
  acknowledge(target: MonitorTarget, eventIDs: string[]): Promise<void>
}
