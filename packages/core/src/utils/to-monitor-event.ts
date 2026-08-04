import type { MonitorEvent, SourceEvent } from "#sourcefed/types"
import type { MonitorSource } from "#sourcefed/sources"

export function toMonitorEvent(event: SourceEvent, source: MonitorSource): MonitorEvent {
  return {
    source,
    kind: event.kind,
    id: event.id,
    at: event.at,
    summary: event.summary,
    body: event.body,
    actionable: event.actionable,
    terminal: event.terminal,
  }
}
