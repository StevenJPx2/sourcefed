import { cleanCiLog } from "./clean-ci-log.ts"
import { fetchRunLog } from "../../api"

export async function failureRunLog(repo: string, runId: string): Promise<string | undefined> {
  const log = await fetchRunLog(repo, runId)
  if (!log || !log.trim()) return undefined
  const tail = cleanCiLog(log).split("\n").slice(-60).join("\n")
  return `\n### Failing log (run ${runId})\n\`\`\`\n${tail}\n\`\`\``
}
