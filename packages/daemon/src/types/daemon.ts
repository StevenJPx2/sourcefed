import type { MonitorEventQueue, MonitorRecord, MonitorStore, MonitorTarget, QueuedMonitorEvent } from "@sourcefed/core"

export type DaemonCreateInput = {
  name: string
  sourceType: string
  issueKey?: string
  repo?: string
  prNumber?: number
  channelId?: string
  threadTs?: string
  threadUrl?: string
  pollIntervalSec?: number
}

export type SourcefedDaemonOptions = {
  store?: MonitorStore
  eventQueue?: MonitorEventQueue
  stateDir?: string
  pollLoopSec?: number
}

export type MonitorView = {
  id: string
  name: string
  source: MonitorRecord["source"]
  target: MonitorRecord["target"]
  delivery: MonitorRecord["delivery"]
  pollIntervalSec: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type DaemonResult =
  | { ok: true; created?: boolean; monitor?: MonitorView; monitors?: MonitorView[]; events?: QueuedMonitorEvent[]; acknowledged?: string[]; removed?: boolean }
  | { ok: false; error: string }
