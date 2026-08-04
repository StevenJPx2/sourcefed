import { sh } from "./sh.ts"

export function confirmStillFailing(repo: string, prNumber: number, failed: any[]): any[] {
  const response = sh(["pr", "view", String(prNumber), "--repo", repo, "--json", "statusCheckRollup"])
  if (response.code !== 0) return failed

  let rollup: any[] = []
  try {
    const parsed = JSON.parse(response.out)
    if (Array.isArray(parsed.statusCheckRollup)) rollup = parsed.statusCheckRollup
  } catch {
    return failed
  }

  const current = new Map<string, string>()
  for (const check of rollup) {
    let name = check.name
    if (!name) name = check.context
    if (!name) name = "check"
    let state = check.conclusion
    if (!state) state = check.state
    if (!state) state = "PENDING"
    current.set(name, String(state).toUpperCase())
  }
  return failed.filter((check) => {
    let name = check.name
    if (!name) name = check.context
    if (!name) name = "check"
    const state = current.get(name)
    if (state === undefined) return false
    return /FAIL|ERROR|CANCEL/i.test(state)
  })
}
