import { failureRunIds } from "./failure-run-ids.ts"
import { failureRunLog } from "./failure-run-log.ts"
import { formatFailedCheck } from "./format-failed-check.ts"

export function ciFailureDetail(repo: string, failed: any[]): string {
  const lines = failed.map(formatFailedCheck)
  const runIds = failureRunIds(failed)
  for (const runId of [...runIds].slice(0, 3)) {
    const log = failureRunLog(repo, runId)
    if (log) lines.push(log)
  }
  return lines.join("\n")
}
