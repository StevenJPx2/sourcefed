import type { MonitorStore } from "../types/monitor-store.ts"
import type { MonitorRegistry } from "../monitors/types/monitor-registry.ts"

export class InMemoryMonitorStore implements MonitorStore {
  private registry: MonitorRegistry

  constructor(initial: MonitorRegistry = { monitors: [] }) {
    this.registry = structuredClone(initial)
  }

  async load(): Promise<MonitorRegistry> {
    return structuredClone(this.registry)
  }

  async save(registry: MonitorRegistry): Promise<void> {
    this.registry = structuredClone(registry)
  }
}
