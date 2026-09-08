import { jiraChangelogEvent } from "./jira-changelog-event.ts"
import type { JiraCursor, JiraEvent } from "../../types"

// Jira's embedded `expand=changelog` returns histories newest-first, so a
// count-based cursor re-surfaces the oldest entries on every new change. Track
// history IDs (like comments) so dedup is order-independent, and emit fresh
// entries chronologically.
export function appendJiraChangelog(issueKey: string, cursor: JiraCursor, events: JiraEvent[], histories: any[]): void {
  const fresh = histories.filter((history) => !cursor.changelogIds.includes(historyId(history)))
  if (cursor.changelogIds.length === 0) {
    cursor.changelogIds = histories.map(historyId)
    return
  }
  for (const history of [...fresh].reverse()) {
    const event = jiraChangelogEvent(issueKey, history)
    if (event) events.push(event)
    cursor.changelogIds.push(historyId(history))
  }
}

function historyId(history: any): string {
  return String(history.id ?? history.created ?? "")
}
