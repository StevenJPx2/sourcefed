export function failureRunIds(failed: any[]): Set<string> {
  const runIds = new Set<string>()
  for (const check of failed) {
    const details = check.detailsUrl ?? check.targetUrl ?? ""
    const runId = String(details).match(/\/actions\/runs\/(\d+)/)?.[1]
    if (runId) runIds.add(runId)
  }
  return runIds
}
