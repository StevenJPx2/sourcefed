import type { GithubEventShape } from "../types/event-shape.ts"
import type { GithubWebhookContext } from "../types/context.ts"

export function parsePullRequestReview({ payload, actor, repo, prNumber }: GithubWebhookContext): GithubEventShape {
  let actionable = false
  if (["changes_requested", "commented"].includes(String(payload.review?.state ?? "").toLowerCase())) actionable = true
  return {
    kind: "review",
    id: payload.review?.id === undefined ? undefined : `review:${payload.review.id}`,
    summary: `GitHub review ${payload.action ?? "changed"} by ${actor} on ${repo}#${prNumber}`,
    body: payload.review?.body,
    actionable,
  }
}
