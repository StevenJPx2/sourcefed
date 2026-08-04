import type { MonitorRecord } from "#sourcefed/monitors"
import { sourceDefinition } from "#sourcefed/source-utils"
import { MAX_REPO_LENGTH } from "../constants.ts"
import { truncateMiddle } from "./truncate-middle.ts"

export function monitorDetail(monitor: MonitorRecord): string {
  const detail = sourceDefinition(monitor.source).detail(monitor.source)
  if (!detail) return ""
  return ` · ${truncateMiddle(detail.replace(/^ · /, ""), MAX_REPO_LENGTH)}`
}
