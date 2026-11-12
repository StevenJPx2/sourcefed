import { cleanCiLog } from "./clean-ci-log.ts"
import type { FailedJob } from "./failed-jobs.ts"
import { fetchJobLog } from "../../api"

export async function failedJobLog(repo: string, job: FailedJob): Promise<string | undefined> {
  const log = await fetchJobLog(repo, job.id)
  if (!log || !log.trim()) return undefined
  const tail = cleanCiLog(log).split("\n").slice(-60).join("\n")
  return `\n### Failing log: ${job.name}\n\`\`\`\n${tail}\n\`\`\``
}
