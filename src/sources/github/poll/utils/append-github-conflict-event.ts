import type { GithubCursor, GithubEvent } from "../../types"

export function appendGithubConflictEvent(repo: string, prNumber: number, cursor: GithubCursor, events: GithubEvent[], mergeable: string): void {
  if (mergeable === cursor.mergeable) return
  const previousMergeable = cursor.mergeable
  cursor.mergeable = mergeable
  if (previousMergeable === undefined) return
  if (mergeable !== "CONFLICTING" && mergeable !== "DIRTY") return
  events.push({
    kind: "conflict",
    id: `conflict:${mergeable}`,
    repo,
    prNumber,
    at: new Date().toISOString(),
    summary: `PR #${prNumber} now has merge conflicts with its base (${mergeable})`,
    actionable: true,
  })
}
