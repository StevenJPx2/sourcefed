import * as v from "valibot"
import { appendGithubCiEvent } from "./append-github-ci-event.ts"
import { appendGithubConflictEvent } from "./append-github-conflict-event.ts"
import { appendGithubReviews } from "./append-github-reviews.ts"
import { appendGithubStateEvent } from "./append-github-state-event.ts"
import { appendComments } from "./append-comments.ts"
import { emptyGithubCursor } from "./empty-cursor.ts"
import { fetchGithubComments, fetchPrData, githubToken } from "../../api"
import { GithubCursorSchema } from "../../schema.ts"
import type { GithubCursor, GithubEvent } from "../../types"

let warnedMissingToken = false

export async function pollGithub(repo: string, prNumber: number, cursorRaw: unknown): Promise<{ events: GithubEvent[]; cursor: GithubCursor; terminal: boolean }> {
  const parsedCursor = v.safeParse(GithubCursorSchema, cursorRaw)
  let cursor = emptyGithubCursor()
  if (parsedCursor.success) cursor = parsedCursor.output
  const events: GithubEvent[] = []
  const ref = `#${prNumber}`

  if (!githubToken()) {
    if (!warnedMissingToken) {
      warnedMissingToken = true
      console.warn("[sourcefed] GH_TOKEN or GITHUB_TOKEN is not set; GitHub monitors will not poll")
    }
    return { events, cursor, terminal: false }
  }

  const data = await fetchPrData(repo, prNumber)
  if (!data) return { events, cursor, terminal: false }

  let historyPrimed = cursor.historyPrimed
  if (!historyPrimed) historyPrimed = Boolean(cursor.reviewIds.length || cursor.commentIds.length || cursor.ciState || cursor.mergeable || cursor.prState)
  const lineCommentsPrimed = cursor.lineCommentsPrimed
  const conversationCommentsPrimed = cursor.conversationCommentsPrimed

  appendGithubReviews(repo, prNumber, cursor, events, data.reviews ?? [], historyPrimed)
  if (!cursor.historyPrimed) cursor.historyPrimed = true

  const lineComments = await fetchGithubComments(`repos/${repo}/pulls/${prNumber}/comments`)
  if (lineComments) {
    appendComments(repo, prNumber, cursor, events, lineComments, "c:", lineCommentsPrimed,
      (comment) => `Comment by ${comment.user?.login ?? "someone"} on ${comment.path ?? ref}`,
      (comment) => {
        let location = comment.path ?? ""
        if (comment.line) location += `:${comment.line}`
        return `${location} — ${comment.body ?? ""}`
      })
    cursor.lineCommentsPrimed = true
  }

  const conversationComments = await fetchGithubComments(`repos/${repo}/issues/${prNumber}/comments`)
  if (conversationComments) {
    appendComments(repo, prNumber, cursor, events, conversationComments, "issue:", conversationCommentsPrimed,
      (comment) => `Comment by ${comment.user?.login ?? "someone"} on ${ref}`,
      (comment) => comment.body ?? "")
    cursor.conversationCommentsPrimed = true
  }

  await appendGithubCiEvent(repo, prNumber, cursor, events, data.statusCheckRollup ?? [])

  const mergeable = data.mergeable ?? data.mergeStateStatus ?? "UNKNOWN"
  appendGithubConflictEvent(repo, prNumber, cursor, events, mergeable)

  const prState = data.state ?? "OPEN"
  const terminal = appendGithubStateEvent(repo, prNumber, cursor, events, prState)

  return { events, cursor, terminal }
}
