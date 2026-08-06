import type { MonitorEvent } from "./monitor-event.ts"

export type SourcePollResult = {
  cursor: unknown
  events: MonitorEvent[]
  terminal: boolean
}
