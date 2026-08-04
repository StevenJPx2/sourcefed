import { adfText } from "./adf-text.ts"
import type { JiraCursor, JiraEvent } from "../../types"

export function appendJiraDescription(issueKey: string, cursor: JiraCursor, events: JiraEvent[], description: any): void {
  let descriptionVersion = "none"
  if (description) descriptionVersion = JSON.stringify(description).slice(0, 40)
  if (cursor.descriptionVersion !== undefined && descriptionVersion !== cursor.descriptionVersion) {
    events.push({
      kind: "description",
      id: `description:${descriptionVersion}`,
      issueKey,
      at: new Date().toISOString(),
      summary: `Jira ${issueKey} description updated`,
      body: adfText(description),
      actionable: true,
    })
  }
  cursor.descriptionVersion = descriptionVersion
}
