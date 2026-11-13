// Shaped on replies recorded on 2026-11-13 with `gh api -i` from
// GET /repos/{repo}/issues?state=open&labels=…&per_page=100 (200 with a weak ETag, then
// 304 to If-None-Match), a paged list's Link header, and GET /search/issues.
// Items are trimmed to the fields sourcefed reads; the repository is anonymised.

export const REPO = "example-org/example-repo"
export const ETAG = 'W/"6c7b65554b1beee3cd8bac65a924c704fa22ee9a56ad8f7f611cade4ac35f042"'

export type RecordedIssue = { number: number; title: string; html_url: string; state: string; labels: string[]; pull_request?: object }

export function issue(number: number, title = `Issue ${number}`): RecordedIssue {
  return { number, title, html_url: `https://github.com/${REPO}/issues/${number}`, state: "open", labels: ["atelier:build"] }
}

export function pullRequest(number: number): RecordedIssue {
  const url = `https://github.com/${REPO}/pull/${number}`
  return { ...issue(number), html_url: url, pull_request: { html_url: url, merged_at: null } }
}

export function listReply(items: RecordedIssue[], options: { etag?: string; next?: string } = {}): Response {
  const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8" }
  if (options.etag) headers.etag = options.etag
  if (options.next) headers.link = `<${options.next}>; rel="next"`
  return new Response(JSON.stringify(items), { status: 200, headers })
}

export function notModified(): Response {
  return new Response(null, { status: 304, headers: { etag: ETAG } })
}

export function nextPage(page: number): string {
  return `https://api.github.com/repositories/1323161442/issues?state=open&labels=atelier%3Abuild&per_page=100&after=Y3Vyc29yOnYyOpLPAAABodNuNtDPAAAAAXtraMQ%3D&page=${page}`
}

export function searchReply(items: RecordedIssue[], totalCount = items.length, incomplete = false): Response {
  const body = { total_count: totalCount, incomplete_results: incomplete, items }
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } })
}
