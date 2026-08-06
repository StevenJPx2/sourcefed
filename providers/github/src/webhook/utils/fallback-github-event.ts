import type { GithubEventShape } from "../types/event-shape.ts"
import type { GithubWebhookContext } from "../types/context.ts"

export function fallbackGithubEvent({ payload, actor, repo, prNumber, eventName }: GithubWebhookContext): GithubEventShape {
  return {
    kind: eventName,
    summary: `GitHub ${eventName} ${payload.action ?? "changed"} by ${actor} on ${repo}#${prNumber}`,
    actionable: true,
  }
}
