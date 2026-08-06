import { fetchPrData } from "../../api"

export async function confirmStillFailing(repo: string, prNumber: number, failed: any[]): Promise<any[]> {
  const data = await fetchPrData(repo, prNumber)
  if (!data) return failed

  const rollup = data.statusCheckRollup ?? []
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
