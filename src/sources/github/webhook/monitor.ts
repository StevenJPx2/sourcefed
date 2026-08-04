import { WebhookMonitor } from "#sourcefed/monitors"
import { updateGithubCursor } from "./utils/update-github-cursor.ts"
import { verifyGithubWebhook } from "./utils"
import { parseGithubWebhook } from "./utils"
import type { GithubSourceRecord } from "../types"

export const githubWebhookMonitor = new WebhookMonitor<GithubSourceRecord>({
  path: "/webhooks/github",
  preferred: true,
  configured: () => Boolean(process.env.SOURCEFED_GITHUB_WEBHOOK_SECRET),
  verify: verifyGithubWebhook,
  deliveryId: (request: Request) => request.headers.get("x-github-delivery") ?? undefined,
  eventName: (request: Request) => request.headers.get("x-github-event") ?? "github",
  parse: parseGithubWebhook,
  updateCursor: updateGithubCursor,
})
