import { jiraChangelogEvent } from "./jira-changelog-event.ts"
import type { JiraCursor, JiraEvent } from "../../types"

export function appendJiraChangelog(issueKey: string, cursor: JiraCursor, events: JiraEvent[], histories: any[]): void {
  const total = histories.length
  if (cursor.changelogCount !== 0 && total > cursor.changelogCount) {
    for (const history of histories.slice(cursor.changelogCount)) {
      const event = jiraChangelogEvent(issueKey, history)
      if (event) events.push(event)
    }
  }
  cursor.changelogCount = total
}
