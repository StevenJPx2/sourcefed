import type { MonitorTarget } from "@sourcefed/core"
import type { SourcefedDaemon } from "./daemon.ts"
import type { DaemonCreateInput } from "./types"

export async function dispatchDaemonRequest(daemon: SourcefedDaemon, method: string, params: Record<string, unknown>): Promise<unknown> {
  switch (method) {
    case "monitor.create":
      return daemon.createMonitor(createTarget(params), createCreateInput(params))
    case "monitor.list":
      return daemon.listMonitors(createTarget(params))
    case "monitor.status":
      return daemon.getMonitor(createTarget(params), String(params.id))
    case "monitor.stop":
      return daemon.stopMonitor(createTarget(params), String(params.id))
    case "monitor.start":
      return daemon.startMonitor(createTarget(params), String(params.id))
    case "monitor.events":
      return { events: await daemon.readEvents(createTarget(params)) }
    case "monitor.ack":
      return daemon.acknowledgeEvents(createTarget(params), (params.eventIDs as string[] | undefined) ?? [])
    case "daemon.sourceTypes":
      return { sourceTypes: daemon.sourceTypes }
    default:
      throw new Error(`unknown daemon method ${method}`)
  }
}

function createTarget(params: Record<string, unknown>): MonitorTarget {
  const target = params.target as Partial<MonitorTarget> | undefined
  if (!target || typeof target.kind !== "string" || typeof target.id !== "string") {
    throw new Error("params.target is required and must be { kind: string, id: string }")
  }
  return { kind: target.kind, id: target.id }
}

function createCreateInput(params: Record<string, unknown>): DaemonCreateInput {
  if (typeof params.name !== "string" || !params.name) throw new Error("monitor.create requires params.name")
  if (typeof params.sourceType !== "string" || !params.sourceType) throw new Error("monitor.create requires params.sourceType")

  const input: DaemonCreateInput = {
    name: params.name,
    sourceType: params.sourceType,
  }
  for (const key of ["issueKey", "repo", "channelId", "threadTs", "threadUrl"] as const) {
    if (typeof params[key] === "string") input[key] = params[key]
  }
  if (typeof params.prNumber === "number") input.prNumber = params.prNumber
  if (params.pollIntervalSec !== undefined) {
    if (typeof params.pollIntervalSec !== "number" || !Number.isFinite(params.pollIntervalSec)) {
      throw new Error("pollIntervalSec must be a number")
    }
    input.pollIntervalSec = params.pollIntervalSec
  }
  return input
}
