// Shaped on replies recorded on 2026-11-13 from Jira Cloud's
// GET /rest/api/3/search/jql?fields=summary&maxResults=… (pages chained by nextPageToken,
// the last with isLast: true and no token; an unbounded query answers 400 with
// errorMessages). Keys, ids and summaries are anonymised.

export const BASE = "https://example.atlassian.net"

export type RecordedIssue = { expand: string; id: string; self: string; key: string; fields: { summary: string } }

export function issue(number: number, summary = `Issue ${number}`): RecordedIssue {
  const id = String(36_000 + number)
  return {
    expand: "renderedFields,names,schema,operations,editmeta,changelog,versionedRepresentations",
    id,
    self: `${BASE}/rest/api/3/issue/${id}`,
    key: `PROJ-${number}`,
    fields: { summary },
  }
}

export function page(issues: RecordedIssue[], nextPageToken?: string): Response {
  const body = nextPageToken ? { issues, nextPageToken, isLast: false } : { issues, isLast: true }
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json;charset=UTF-8" } })
}

export function unbounded(): Response {
  const body = { errorMessages: ["Unbounded JQL queries are not allowed here. Please add a search restriction to your query."], errors: {} }
  return new Response(JSON.stringify(body), { status: 400, headers: { "content-type": "application/json;charset=UTF-8" } })
}
