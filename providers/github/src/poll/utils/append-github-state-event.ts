import type { GithubCursor, GithubEvent } from "../../types"

export function appendGithubStateEvent(repo: string, prNumber: number, cursor: GithubCursor, events: GithubEvent[], prState: string): boolean {
  if (prState === cursor.prState) return prState === "MERGED"
  const previousPrState = cursor.prState
  cursor.prState = prState
  if (previousPrState !== undefined && (prState === "MERGED" || prState === "CLOSED")) {
    let summary = `PR #${prNumber} was CLOSED without merging`
    if (prState === "MERGED") summary = `PR #${prNumber} was MERGED`
    events.push({
      kind: "merged",
      id: `state:${prState}`,
      repo,
      prNumber,
      at: new Date().toISOString(),
      summary,
      actionable: prState === "MERGED",
      terminal: prState === "MERGED",
    })
  }
  return prState === "MERGED"
}
