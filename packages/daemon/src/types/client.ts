import type { ChildProcess } from "node:child_process"
import type { MonitorTarget, QueuedMonitorEvent } from "@sourcefed/core"

export type DaemonClientOptions = {
  name: string
  url?: string
  token?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
}

export interface DaemonClient {
  request(method: string, params?: Record<string, unknown>): Promise<unknown>
  subscribe(target: MonitorTarget, onEvents: (events: QueuedMonitorEvent[]) => Promise<void>): Promise<{ close(): Promise<void> }>
  close(): Promise<void>
}

export type SpawnDaemonResult = {
  url: string
  proc?: ChildProcess
}
