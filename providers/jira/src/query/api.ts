import { COLLECTION_LIMIT, type CollectionListing } from "@sourcefed/core"
import { jiraAuth } from "../poll/utils/jira-auth.ts"

const PAGE_SIZE = 100
const MAX_PAGES = Math.ceil(COLLECTION_LIMIT / PAGE_SIZE) + 1
const TIMEOUT_MS = 30_000

export type JiraIssue = { key: string; title: string; url: string }

export type JiraFetch = (path: string) => Promise<Response>

/**
 * Every issue matching the JQL, through Jira's enhanced search, ordered by key
 * unless the JQL orders itself. A failed reply throws, so a poll never compares
 * against a partial list.
 */
export async function searchIssues(jql: string, request: JiraFetch = jiraFetch): Promise<CollectionListing<JiraIssue>> {
  const issues: JiraIssue[] = []
  let token: string | undefined
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams({ jql: orderedByKey(jql), fields: "summary", maxResults: String(PAGE_SIZE) })
    if (token) query.set("nextPageToken", token)

    const response = await request(`/rest/api/3/search/jql?${query}`)
    const body = await jiraBody(response)
    for (const issue of body.issues ?? []) issues.push(toIssue(issue))
    if (issues.length > COLLECTION_LIMIT) return { overLimit: true }

    token = typeof body.nextPageToken === "string" ? body.nextPageToken : undefined
    if (body.isLast !== false || !token) return { overLimit: false, items: issues }
  }
  return { overLimit: true }
}

export function orderedByKey(jql: string): string {
  return /\border\s+by\b/i.test(jql) ? jql : `${jql} ORDER BY key ASC`
}

export function issueUrl(key: string): string {
  return `${jiraBase()}/browse/${key}`
}

function toIssue(item: any): JiraIssue {
  const key = String(item.key)
  return { key, title: String(item.fields?.summary ?? ""), url: issueUrl(key) }
}

async function jiraBody(response: Response): Promise<any> {
  if (response.ok) return response.json()

  const body = await response.json().catch(() => undefined) as { errorMessages?: string[] } | undefined
  const detail = body?.errorMessages?.join("; ")
  throw new Error(`Jira search answered ${response.status}${detail ? `: ${detail}` : ""}`)
}

function jiraBase(): string {
  const base = process.env.SOURCEFED_JIRA_BASE_URL
  if (!base) throw new Error("SOURCEFED_JIRA_BASE_URL is required for jira-query monitors")
  return base.replace(/\/+$/, "")
}

async function jiraFetch(path: string): Promise<Response> {
  return fetch(`${jiraBase()}${path}`, {
    headers: { Authorization: jiraAuth(), Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
}
