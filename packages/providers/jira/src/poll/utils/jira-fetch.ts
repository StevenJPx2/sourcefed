import { jiraAuth } from "./jira-auth.ts"

const JIRA_BASE = process.env.SOURCEFED_JIRA_BASE_URL

export async function jiraFetch(path: string): Promise<any> {
  if (!JIRA_BASE) throw new Error("SOURCEFED_JIRA_BASE_URL is required for Jira monitors")

  const response = await fetch(`${JIRA_BASE}/rest/api/3${path}`, {
    headers: { Authorization: jiraAuth(), Accept: "application/json" },
  })
  if (!response.ok) throw new Error(`Jira ${response.status} for ${path}`)
  return response.json()
}
