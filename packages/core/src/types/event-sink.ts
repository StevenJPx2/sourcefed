import type { MonitorEvent } from "./monitor-event.ts"
import type { MonitorRecord } from "../monitors/types/monitor-record.ts"

export type EventDeliveryResult = {
  ok: boolean
  error?: string
}

export interface MonitorEventSink {
  deliver(input: { monitor: MonitorRecord; event: MonitorEvent }): Promise<EventDeliveryResult>
}
