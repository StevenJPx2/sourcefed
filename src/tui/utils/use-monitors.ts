import { createSignal, onCleanup } from "solid-js"
import type { MonitorRecord } from "#sourcefed/monitors"
import { listMonitors } from "#sourcefed/monitors"
import { REFRESH_MS } from "../constants.ts"

export function useMonitors(sessionID: string | undefined): { monitors: () => MonitorRecord[] } {
  const [monitors, setMonitors] = createSignal<MonitorRecord[]>([])

  const refresh = async () => {
    try {
      const all = await listMonitors()
      if (sessionID) {
        setMonitors(all.filter((monitor) => monitor.sessionID === sessionID))
      } else {
        setMonitors([])
      }
    } catch {
      setMonitors([])
    }
  }

  void refresh()
  const timer = setInterval(() => void refresh(), REFRESH_MS)
  onCleanup(() => clearInterval(timer))

  return { monitors }
}
