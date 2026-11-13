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
  subscribe(target: MonitorTarget, onEvents: (events: QueuedMonitorEvent[]) => Promise<void>, options?: SubscribeOptions): Promise<{ close(): Promise<void> }>
  close(): Promise<void>
}

/**
 * `acknowledge: false` leaves acknowledgement to the caller (`monitor.ack`), as a
 * program does once it has acted; the events stay claimed by this subscription
 * and come again when it reconnects.
 */
export type SubscribeOptions = {
  signal?: AbortSignal
  acknowledge?: boolean
}

export type SpawnDaemonResult = {
  url: string
  proc?: ChildProcess
}
