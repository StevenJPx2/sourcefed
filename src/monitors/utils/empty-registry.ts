import type { MonitorRegistry } from "../types"

export function emptyRegistry(): MonitorRegistry {
  return { monitors: [] }
}
