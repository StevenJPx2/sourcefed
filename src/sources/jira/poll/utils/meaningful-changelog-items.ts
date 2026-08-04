import { jiraChangeValue } from "./jira-change-value.ts"

const TRACKED_CHANGE_FIELDS = new Set(["summary", "status", "assignee", "priority", "labels"])

export function meaningfulChangelogItems(items: any[]): any[] {
  return items.filter((item) => {
    if (!TRACKED_CHANGE_FIELDS.has(String(item.field))) return false
    return jiraChangeValue(item, "from") !== jiraChangeValue(item, "to")
  })
}
