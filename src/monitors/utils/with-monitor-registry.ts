import type { MonitorRegistry } from "../types"
import { loadMonitors } from "./load-monitors.ts"
import { saveMonitors } from "./save-monitors.ts"

type RegistryOperation<T> = (registry: MonitorRegistry) => T | Promise<T>

let registryQueue = Promise.resolve()

export function withMonitorRegistry<T>(operation: RegistryOperation<T>): Promise<T> {
  const next = registryQueue.then(async () => {
    const registry = await loadMonitors()
    const result = await operation(registry)
    await saveMonitors(registry)
    return result
  })
  registryQueue = next.then(() => undefined, () => undefined)
  return next
}
