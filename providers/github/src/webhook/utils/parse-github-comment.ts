import type { GithubEventShape } from "../types/event-shape.ts"
import type { GithubWebhookContext } from "../types/context.ts"

export function parseGithubComment({ payload, actor, repo, prNumber, eventName }: GithubWebhookContext): GithubEventShape {
  return {
    kind: "comment",
    id: payload.comment?.id === undefined ? undefined : `${eventName === "issue_comment" ? "issue:" : "c:"}${payload.comment.id}`,
    summary: `GitHub comment by ${actor} on ${repo}#${prNumber}`,
    body: payload.comment?.body,
    actionable: true,
  }
}
