import type { GithubEventShape } from "../types/event-shape.ts"
import type { GithubWebhookContext } from "../types/context.ts"

export function parsePullRequest({ payload, repo, prNumber }: GithubWebhookContext): GithubEventShape {
  const merged = payload.action === "closed" && payload.pull_request?.merged === true
  let kind = payload.action ?? "changed"
  if (payload.action === "synchronize") kind = "commit"
  if (merged) kind = "merged"
  let summary = `GitHub PR ${payload.action ?? "changed"}`
  if (merged) summary += " and merged"
  summary += ` on ${repo}#${prNumber}`
  let body = payload.pull_request?.body
  if (merged) body = undefined
  let id: string | undefined
  if (merged) id = "pr:MERGED"
  if (payload.action === "closed" && !merged) id = "pr:CLOSED"
  return { kind, id, summary, body, actionable: true }
}
