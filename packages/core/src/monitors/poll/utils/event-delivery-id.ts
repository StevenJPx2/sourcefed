import type { MonitorEvent } from "#sourcefed/types"

export function eventDeliveryId(event: MonitorEvent): string {
  if (event.id) return event.id
  return `${event.kind}:${event.at}:${event.summary}`
}
