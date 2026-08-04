import { Monitor } from "#sourcefed/monitors"
import type { Delivery, MonitorCreateInput } from "#sourcefed/types"
import type { GithubSourceRecord } from "./types"
import type { SourceInput } from "#sourcefed/sources"
import { GithubSourceSchema } from "./schema.ts"
import { githubPollMonitor } from "./poll"
import { githubWebhookMonitor } from "./webhook"

export class GithubMonitor extends Monitor<GithubSourceRecord> {
  readonly poll = githubPollMonitor
  readonly webhook = githubWebhookMonitor

  constructor() {
    super({ type: "github", schema: GithubSourceSchema })
  }

  readonly key = (source: GithubSourceRecord): string => `github:${source.repo}#${source.prNumber}`
  readonly icon = "󰊤"
  readonly label = (source: GithubSourceRecord): string => `#${source.prNumber}`
  readonly detail = (source: GithubSourceRecord): string => ` · ${source.repo}`
  readonly describe = (source: GithubSourceRecord): string => `GitHub ${source.repo}#${source.prNumber}`
  readonly cursorSummary = (cursor: Record<string, any>): string => `reviews ${cursor.reviewIds?.length ?? 0}, comments ${cursor.commentIds?.length ?? 0}, CI ${cursor.ciState || "not checked"}, PR ${cursor.prState || "unknown"}`
  readonly deliveryHint = (delivery: Delivery): string => {
    if (delivery === "webhook") return "GitHub webhook delivery is active."
    return "GitHub webhook delivery is unavailable, so polling is active."
  }

  build(input: MonitorCreateInput): SourceInput {
    if (input.repo && input.prNumber) return { type: "github", repo: input.repo, prNumber: input.prNumber }
    return { error: "repo and prNumber are required for a github monitor" }
  }
}
