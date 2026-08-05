import { Monitor } from "@sourcefed/core"
import type { MonitorCreateInput } from "@sourcefed/core"
import type { GithubSourceRecord } from "./types"
import type { SourceInput } from "@sourcefed/core"
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

  build(input: MonitorCreateInput): SourceInput {
    if (input.repo && input.prNumber) return { type: "github", repo: input.repo, prNumber: input.prNumber }
    return { error: "repo and prNumber are required for a github monitor" }
  }
}
