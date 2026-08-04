import * as v from "valibot"
import { appendGithubCiEvent } from "./append-github-ci-event.ts"
import { appendGithubConflictEvent } from "./append-github-conflict-event.ts"
import { appendGithubReviews } from "./append-github-reviews.ts"
import { appendGithubStateEvent } from "./append-github-state-event.ts"
import { appendComments } from "./append-comments.ts"
import { emptyGithubCursor } from "./empty-cursor.ts"
import { fetchGithubComments } from "./fetch-github-comments.ts"
import { parseGithubData } from "./parse-github-data.ts"
import { sh } from "./sh.ts"
import { GithubCursorSchema } from "../../schema.ts"
import type { GithubCursor, GithubEvent } from "../../types"

export function pollGithub(repo: string, prNumber: number, cursorRaw: unknown): { events: GithubEvent[]; cursor: GithubCursor; terminal: boolean } {
  const parsedCursor = v.safeParse(GithubCursorSchema, cursorRaw)
  let cursor = emptyGithubCursor()
  if (parsedCursor.success) cursor = parsedCursor.output
  const events: GithubEvent[] = []
  const ref = `#${prNumber}`

  const response = sh(["pr", "view", String(prNumber), "--repo", repo, "--json", "comments,statusCheckRollup,reviewDecision,reviews,mergeable,mergeStateStatus,state"])
  if (response.code !== 0) return { events, cursor, terminal: false }
  const data = parseGithubData(response.out)
  if (!data) return { events, cursor, terminal: false }

  let historyPrimed = cursor.historyPrimed
  if (!historyPrimed) historyPrimed = Boolean(cursor.reviewIds.length || cursor.commentIds.length || cursor.ciState || cursor.mergeable || cursor.prState)
  const conversationCommentsPrimed = cursor.conversationCommentsPrimed

  appendGithubReviews(repo, prNumber, cursor, events, data.reviews ?? [], historyPrimed)

  const lineComments = fetchGithubComments(`repos/${repo}/pulls/${prNumber}/comments`)
  if (lineComments) {
    appendComments(repo, prNumber, cursor, events, lineComments, "c:", historyPrimed,
      (comment) => `Comment by ${comment.user?.login ?? "someone"} on ${comment.path ?? ref}`,
      (comment) => {
        let location = comment.path ?? ""
        if (comment.line) location += `:${comment.line}`
        return `${location} — ${comment.body ?? ""}`
      })
  }

  const conversationComments = fetchGithubComments(`repos/${repo}/issues/${prNumber}/comments`)
  if (conversationComments) {
    appendComments(repo, prNumber, cursor, events, conversationComments, "issue:", conversationCommentsPrimed,
      (comment) => `Comment by ${comment.user?.login ?? "someone"} on ${ref}`,
      (comment) => comment.body ?? "")
  }

  appendGithubCiEvent(repo, prNumber, cursor, events, data.statusCheckRollup ?? [])

  const mergeable = data.mergeable ?? data.mergeStateStatus ?? "UNKNOWN"
  appendGithubConflictEvent(repo, prNumber, cursor, events, mergeable)

  const prState = data.state ?? "OPEN"
  const terminal = appendGithubStateEvent(repo, prNumber, cursor, events, prState)

  cursor.historyPrimed = true
  cursor.conversationCommentsPrimed = true
  return { events, cursor, terminal }
}
