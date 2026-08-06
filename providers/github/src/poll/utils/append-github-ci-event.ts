import { ciFailureDetail } from "./ci-failure-detail.ts"
import { confirmStillFailing } from "./confirm-still-failing.ts"
import type { GithubCursor, GithubEvent } from "../../types"

export async function appendGithubCiEvent(repo: string, prNumber: number, cursor: GithubCursor, events: GithubEvent[], rollup: any[]): Promise<void> {
  const ciState = rollup.map((check) => check.conclusion ?? check.state ?? "PENDING").sort().join(",")
  if (!ciState || ciState === cursor.ciState) return

  const previousCiState = cursor.ciState
  cursor.ciState = ciState
  if (previousCiState === undefined) return

  let failed = rollup.filter((check) => /FAIL|ERROR|CANCEL/i.test(check.conclusion ?? ""))
  failed = await confirmStillFailing(repo, prNumber, failed)
  const failureState = failed.map((check) => `${check.name ?? check.context ?? "check"}:${check.conclusion ?? check.state ?? "FAILURE"}`).sort().join(",")
  if (failed.length > 0 && failureState !== cursor.ciFailureState) {
    const names = failed.map((check) => check.name ?? check.context ?? "check").join(", ")
      events.push({
        kind: "ci",
        id: `ci:${failureState}`,
      repo,
      prNumber,
      at: new Date().toISOString(),
      summary: `CI failed on #${prNumber}: ${names}`,
      body: await ciFailureDetail(repo, failed),
      actionable: true,
    })
  }
  cursor.ciFailureState = failureState
}
