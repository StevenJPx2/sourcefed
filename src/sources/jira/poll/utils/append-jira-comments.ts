import { SOURCEFED_COMMENT_MARKER } from "../../../../marker.ts"
import { adfText } from "./adf-text.ts"
import type { JiraCursor, JiraEvent } from "../../types"

export function appendJiraComments(issueKey: string, cursor: JiraCursor, events: JiraEvent[], comments: any[]): void {
  const freshComments: any[] = []
  for (const comment of comments) {
    const id = Number(comment.id)
    if (cursor.commentIds.includes(id)) continue
    freshComments.push(comment)
  }
  if (cursor.commentIds.length === 0) {
    cursor.commentIds = freshComments.map((comment) => Number(comment.id))
    return
  }
  for (const comment of freshComments) {
    const body = adfText(comment.body)
    events.push({
      kind: "comment",
      id: `comment:${comment.id}`,
      issueKey,
      at: comment.created ?? new Date().toISOString(),
      summary: `Jira ${issueKey} comment by ${comment.author?.displayName ?? "someone"}`,
      body,
      author: comment.author?.displayName,
      actionable: !body.includes(SOURCEFED_COMMENT_MARKER),
    })
    cursor.commentIds.push(Number(comment.id))
  }
}
