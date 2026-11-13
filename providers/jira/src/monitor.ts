import { Monitor } from "@sourcefed/core"
import type { MonitorCreateInput } from "@sourcefed/core"
import type { JiraSourceRecord } from "./types"
import type { SourceInput } from "@sourcefed/core"
import { JiraSourceSchema } from "./schema.ts"
import { jiraPollMonitor } from "./poll"

export class JiraMonitor extends Monitor<JiraSourceRecord> {
  readonly poll = jiraPollMonitor

  constructor() {
    super({ type: "jira", schema: JiraSourceSchema })
  }

  readonly key = (source: JiraSourceRecord): string => `jira:${source.issueKey}`
  readonly input = {
    description: "A Jira issue: new comments, description edits, and status, assignee, priority or label changes",
    properties: { issueKey: { type: "string", description: "Jira issue key, e.g. PROJ-12345" } },
    required: ["issueKey"],
  }
  readonly icon = "󰌃"
  readonly label = (source: JiraSourceRecord): string => source.issueKey
  readonly detail = (source: JiraSourceRecord): string => ` ${source.issueKey}`
  readonly describe = (source: JiraSourceRecord): string => `Jira ${source.issueKey}`

  build(input: MonitorCreateInput): SourceInput {
    if (input.issueKey) return { type: "jira", issueKey: input.issueKey }
    return { error: "issueKey is required for a jira monitor" }
  }
}
