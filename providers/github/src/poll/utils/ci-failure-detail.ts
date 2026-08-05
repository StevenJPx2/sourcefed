import { failureRunIds } from "./failure-run-ids.ts"
import { failureRunLog } from "./failure-run-log.ts"
import { formatFailedCheck } from "./format-failed-check.ts"

export async function ciFailureDetail(repo: string, failed: any[]): Promise<string> {
  const lines = failed.map(formatFailedCheck)
  const runIds = failureRunIds(failed)
  for (const runId of [...runIds].slice(0, 3)) {
    const log = await failureRunLog(repo, runId)
    if (log) lines.push(log)
  }
  return lines.join("\n")
}
