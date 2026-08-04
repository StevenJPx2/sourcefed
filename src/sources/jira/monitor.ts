import { Monitor } from "#sourcefed/monitors"
import type { Delivery, MonitorCreateInput } from "#sourcefed/types"
import type { JiraSourceRecord } from "./types"
import type { SourceInput } from "#sourcefed/sources"
import { JiraSourceSchema } from "./schema.ts"
import { jiraPollMonitor } from "./poll"

export class JiraMonitor extends Monitor<JiraSourceRecord> {
  readonly poll = jiraPollMonitor

  constructor() {
    super({ type: "jira", schema: JiraSourceSchema })
  }

  readonly key = (source: JiraSourceRecord): string => `jira:${source.issueKey}`
  readonly icon = "󰌃"
  readonly label = (source: JiraSourceRecord): string => source.issueKey
  readonly detail = (): string => ""
  readonly describe = (source: JiraSourceRecord): string => `Jira ${source.issueKey}`
  readonly cursorSummary = (cursor: Record<string, any>): string => {
    let description = "not tracked"
    if (cursor.descriptionVersion) description = "tracked"
    return `comments ${cursor.commentIds?.length ?? 0}, history ${cursor.changelogCount ?? 0}, description ${description}`
  }
  readonly deliveryHint = (_delivery: Delivery): string => "Jira uses polling."

  build(input: MonitorCreateInput): SourceInput {
    if (input.issueKey) return { type: "jira", issueKey: input.issueKey }
    return { error: "issueKey is required for a jira monitor" }
  }
}
