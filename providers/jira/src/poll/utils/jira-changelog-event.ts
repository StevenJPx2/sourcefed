import { formatJiraChangelogItem } from "./format-jira-changelog-item.ts"
import { isTerminalStatus } from "./is-terminal-status.ts"
import { jiraChangeValue } from "./jira-change-value.ts"
import { meaningfulChangelogItems } from "./meaningful-changelog-items.ts"
import type { JiraEvent } from "../../types"

export function jiraChangelogEvent(issueKey: string, history: any): JiraEvent | undefined {
  const changes = meaningfulChangelogItems(history.items ?? [])
  const items = changes.map(formatJiraChangelogItem).join("; ")
  if (!items) return undefined
  const terminal = changes.some((item) => item.field === "status" && isTerminalStatus(jiraChangeValue(item, "to")))
  return {
    kind: "changelog",
    id: `history:${history.id ?? history.created ?? items}`,
    issueKey,
    at: history.created ?? new Date().toISOString(),
    summary: `Jira ${issueKey} ${items}`,
    body: items,
    author: history.author?.displayName,
    actionable: true,
    terminal,
  }
}
