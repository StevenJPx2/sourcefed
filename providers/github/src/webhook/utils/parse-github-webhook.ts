import type { MonitorEvent } from "@sourcefed/core"
import { htmlToMarkdown } from "../../utils/html-to-markdown.ts"
import { fallbackGithubEvent } from "./fallback-github-event.ts"
import { githubEventHandlers } from "./github-event-handlers.ts"
import { githubPullRequestNumber } from "./pull-request-number.ts"

export function parseGithubWebhook(payload: any, eventName: string, _deliveryId: string): MonitorEvent | undefined {
  const repo = payload.repository?.full_name
  const prNumber = githubPullRequestNumber(payload, eventName)
  if (!repo || prNumber === undefined) return undefined
  if (eventName === "pull_request" && payload.action === "edited") return undefined

  const handler = githubEventHandlers[eventName] ?? fallbackGithubEvent
  const actor = payload.sender?.login ?? payload.review?.user?.login ?? "someone"
  const shape = handler({ payload, actor, repo, prNumber, eventName })
  if (eventName === "pull_request_review" && !shape.body?.trim()) return undefined
  let body = shape.body
  if (shape.kind === "merged") body = ""

  const event: MonitorEvent = {
    source: { type: "github", repo, prNumber },
    kind: shape.kind,
    id: shape.id,
    at: payload.repository?.updated_at ?? new Date().toISOString(),
    summary: shape.summary,
    body: htmlToMarkdown(body || undefined),
    actionable: shape.actionable,
    terminal: shape.kind === "merged" || shape.kind === "closed",
  }
  return event
}
