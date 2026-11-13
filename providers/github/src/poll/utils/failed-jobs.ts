export type FailedJob = { id: string; name: string }

const ACTIONS_JOB_URL = /\/actions\/runs\/\d+\/job\/(\d+)/

// A run's log holds every job in it, so only a check that names its own Actions job, and whose
// conclusion is failure, has a log that explains the failure.
export function failedJobs(checks: any[]): FailedJob[] {
  const jobs = new Map<string, FailedJob>()
  for (const check of checks) {
    if (String(check.conclusion ?? "").toUpperCase() !== "FAILURE") continue
    const id = String(check.detailsUrl ?? "").match(ACTIONS_JOB_URL)?.[1]
    if (id) jobs.set(id, { id, name: check.name ?? "check" })
  }
  return [...jobs.values()]
}
