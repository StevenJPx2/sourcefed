import { withMonitorRegistry } from "./with-monitor-registry.ts"

export async function removeMonitor(id: string): Promise<void> {
  await withMonitorRegistry((registry) => {
    registry.monitors = registry.monitors.filter((monitor) => monitor.id !== id)
  })
}
