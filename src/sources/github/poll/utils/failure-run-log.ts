import { cleanCiLog } from "./clean-ci-log.ts"
import { sh } from "./sh.ts"

export function failureRunLog(repo: string, runId: string): string | undefined {
  const log = sh(["run", "view", runId, "--repo", repo, "--log-failed"])
  if (log.code !== 0 || !log.out.trim()) return undefined
  const tail = cleanCiLog(log.out).split("\n").slice(-60).join("\n")
  return `\n### Failing log (run ${runId})\n\`\`\`\n${tail}\n\`\`\``
}
