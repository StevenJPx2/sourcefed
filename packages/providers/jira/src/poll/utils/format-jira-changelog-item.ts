import { jiraChangeValue } from "./jira-change-value.ts"

export function formatJiraChangelogItem(item: any): string {
  return `${item.field}: ${jiraChangeValue(item, "from")} → ${jiraChangeValue(item, "to")}`
}
