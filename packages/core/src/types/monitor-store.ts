import type { MonitorRegistry } from "../monitors/types/monitor-registry.ts"

export interface MonitorStore {
  load(): Promise<MonitorRegistry>
  save(registry: MonitorRegistry): Promise<void>
  acquireExclusive?(): Promise<() => Promise<void>>
}
