import { Monitor, type MonitorCreateInput, type SourceInput } from "@sourcefed/core"
import { filterText } from "./events.ts"
import { githubIssuesPollMonitor } from "./poll.ts"
import { GithubIssuesSourceSchema, type GithubIssuesSource } from "./schema.ts"

const REPO = /^[\w.-]+\/[\w.-]+$/

export class GithubIssuesMonitor extends Monitor<GithubIssuesSource> {
  readonly poll = githubIssuesPollMonitor
  readonly wake = {
    path: "/webhooks/github",
    matches: (source: GithubIssuesSource, payload: unknown, eventName: string): boolean => {
      const repo = (payload as { repository?: { full_name?: unknown } })?.repository?.full_name
      return eventName === "issues" && typeof repo === "string" && repo.toLowerCase() === source.repo.toLowerCase()
    },
  }

  constructor() {
    super({ type: "github-issues", schema: GithubIssuesSourceSchema })
  }

  readonly key = (source: GithubIssuesSource): string =>
    `github-issues:${source.repo}:${source.labels.join(",")}:${source.assignee ?? ""}:${source.author ?? ""}:${source.query ?? ""}`
  readonly input = {
    description: "Open GitHub issues in a repository carrying every given label: item.matched when an issue starts matching, item.unmatched when it stops",
    properties: {
      repo: { type: "string", description: "GitHub owner/name, e.g. owner/repository" },
      labels: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1, description: "Labels an issue must all carry" },
      assignee: { type: "string", description: "Only issues assigned to this login" },
      author: { type: "string", description: "Only issues opened by this login" },
      query: { type: "string", description: "Extra GitHub search terms, e.g. 'milestone:v2'; uses the search API" },
      includeExisting: { type: "boolean", description: "Send item.matched for every issue already matching on the first poll" },
    },
    required: ["repo", "labels"],
  }
  readonly icon = "󰊤"
  readonly label = (source: GithubIssuesSource): string => source.labels.join(", ")
  readonly detail = (source: GithubIssuesSource): string => ` ${source.repo} · ${filterText(source)}`
  readonly describe = (source: GithubIssuesSource): string => `GitHub issues in ${source.repo} with ${filterText(source)}`

  build(input: MonitorCreateInput): SourceInput {
    if (!input.repo || !REPO.test(input.repo)) return { error: "repo must be owner/name for a github-issues monitor" }

    const labels = [...new Set((input.labels ?? []).map((label) => label.trim()).filter(Boolean))].sort()
    if (labels.length === 0) return { error: "labels is required for a github-issues monitor" }

    const source: GithubIssuesSource = { type: "github-issues", repo: input.repo, labels }
    if (input.assignee) source.assignee = input.assignee
    if (input.author) source.author = input.author
    if (input.query) source.query = input.query
    if (input.includeExisting) source.includeExisting = true
    return source
  }
}
