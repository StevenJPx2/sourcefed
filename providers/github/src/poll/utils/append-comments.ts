import type { GithubCursor, GithubEvent } from "../../types"

export function appendComments(
  repo: string,
  prNumber: number,
  cursor: GithubCursor,
  events: GithubEvent[],
  comments: any[],
  idPrefix: string,
  historyPrimed: boolean,
  summary: (comment: any) => string,
  body: (comment: any) => string,
): void {
  for (const comment of comments) {
    const id = idPrefix + String(comment.id)
    if (cursor.commentIds.includes(id)) continue
    cursor.commentIds.push(id)
    if (!historyPrimed) continue
    const text = body(comment)
      events.push({
        kind: "comment",
        id,
      repo,
      prNumber,
      at: comment.created_at ?? new Date().toISOString(),
      summary: summary(comment),
      body: text,
      actionable: Boolean(text.trim()),
    })
  }
}
