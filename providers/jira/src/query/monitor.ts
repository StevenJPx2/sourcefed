import { Monitor, type MonitorCreateInput, type SourceInput } from "@sourcefed/core"
import { jiraQueryPollMonitor } from "./poll.ts"
import { JiraQuerySourceSchema, type JiraQuerySource } from "./schema.ts"

export class JiraQueryMonitor extends Monitor<JiraQuerySource> {
  readonly poll = jiraQueryPollMonitor

  constructor() {
    super({ type: "jira-query", schema: JiraQuerySourceSchema })
  }

  readonly key = (source: JiraQuerySource): string => `jira-query:${source.jql}`
  readonly input = {
    description: "Jira issues matching a JQL query: item.matched when an issue starts matching, item.unmatched when it stops",
    properties: {
      jql: { type: "string", minLength: 1, description: "A bounded JQL query, e.g. 'project = PROJ AND labels = agent'" },
      includeExisting: { type: "boolean", description: "Send item.matched for every issue already matching on the first poll" },
    },
    required: ["jql"],
  }
  readonly icon = "󰌃"
  readonly label = (): string => "JQL"
  readonly detail = (source: JiraQuerySource): string => ` ${source.jql}`
  readonly describe = (source: JiraQuerySource): string => `Jira issues matching "${source.jql}"`

  build(input: MonitorCreateInput): SourceInput {
    const jql = input.jql?.trim()
    if (!jql) return { error: "jql is required for a jira-query monitor" }

    const source: JiraQuerySource = { type: "jira-query", jql }
    if (input.includeExisting) source.includeExisting = true
    return source
  }
}
