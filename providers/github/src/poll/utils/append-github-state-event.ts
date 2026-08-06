import type { GithubCursor, GithubEvent } from "../../types"

export function appendGithubStateEvent(repo: string, prNumber: number, cursor: GithubCursor, events: GithubEvent[], prState: string): boolean {
  const isTerminal = prState === "MERGED" || prState === "CLOSED"
  if (prState === cursor.prState) return isTerminal
  const previousPrState = cursor.prState
  cursor.prState = prState
  if (previousPrState !== undefined && isTerminal) {
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
      terminal: isTerminal,
    })
  }
  return isTerminal
}
