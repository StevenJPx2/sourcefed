import type { MonitorEventSink } from "./event-sink.ts"
import type { Monitor } from "#sourcefed/monitors"
import type { MonitorSourceRegistry } from "#sourcefed/sources"
import type { MonitorService } from "../monitors/service.ts"

export type MonitorContext = {
  service: MonitorService
  sink: MonitorEventSink
  sources: MonitorSourceRegistry
  sourceForWebhookPath: (path: string) => Monitor | undefined
}
