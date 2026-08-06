import type { MonitorTarget, QueuedMonitorEvent } from "@sourcefed/core"

export type DaemonRequest = {
  id?: number
  method: string
  params?: Record<string, unknown>
}

export type DaemonResponse = {
  id?: number
  result?: unknown
  error?: string
}

export type DaemonEventFrame = {
  type: "event"
  target: MonitorTarget
  events: QueuedMonitorEvent[]
}

export type DaemonFrame = DaemonResponse | DaemonEventFrame | { type: "subscribed"; target: MonitorTarget }

export function parseDaemonFrame(line: string): DaemonFrame | undefined {
  try {
    return JSON.parse(line) as DaemonFrame
  } catch {
    return undefined
  }
}
