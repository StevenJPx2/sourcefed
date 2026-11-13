import { COLLECTION_LIMIT, type CollectionListing } from "@sourcefed/core"
import { githubToken } from "../api/client.ts"
import type { GithubIssuesSource } from "./schema.ts"

const API = "https://api.github.com"
const PAGE_SIZE = 100
// Pull requests share the issues list, so allow pages beyond the item limit before giving up.
const MAX_PAGES = 20
const TIMEOUT_MS = 30_000

export type GithubIssue = { repo: string; number: number; title: string; url: string }

export type IssueListing =
  | { status: "unchanged" }
  | { status: "listed"; listing: CollectionListing<GithubIssue>; etag?: string }

export type GithubFetch = (url: string, headers: Record<string, string>) => Promise<Response>

/**
 * Every open issue matching the source, through the issues list (with its ETag
 * when the list fits one page) or, with a `query`, the search API. Any failure
 * or incomplete result throws, so a poll never compares against a partial list.
 */
export async function listIssues(source: GithubIssuesSource, etag: string | undefined, request: GithubFetch = githubFetch): Promise<IssueListing> {
  if (source.query) return searchIssues(source, request)

  const issues: GithubIssue[] = []
  let url: string | undefined = issuesUrl(source)
  for (let page = 0; url && page < MAX_PAGES; page += 1) {
    const conditional: Record<string, string> = page === 0 && etag ? { "if-none-match": etag } : {}
    const response = await request(url, conditional)
    if (page === 0 && response.status === 304) return { status: "unchanged" }

    const body = await githubBody(response, url)
    if (!Array.isArray(body)) throw new Error(`GitHub gave an unexpected issues list for ${source.repo}`)

    for (const item of body) {
      if (!item.pull_request) issues.push(toIssue(source.repo, item))
    }
    if (issues.length > COLLECTION_LIMIT) return { status: "listed", listing: { overLimit: true } }

    url = nextLink(response.headers.get("link"))
    if (!url) {
      const single = page === 0 ? response.headers.get("etag") ?? undefined : undefined
      return { status: "listed", listing: { overLimit: false, items: issues }, etag: single }
    }
  }
  return { status: "listed", listing: { overLimit: true } }
}

async function searchIssues(source: GithubIssuesSource, request: GithubFetch): Promise<IssueListing> {
  const issues: GithubIssue[] = []
  const query = new URLSearchParams({ q: searchQuery(source), per_page: String(PAGE_SIZE), sort: "created", order: "asc" })
  let url: string | undefined = `${API}/search/issues?${query}`
  for (let page = 0; url && page < MAX_PAGES; page += 1) {
    const response = await request(url, {})
    const body = await githubBody(response, url)
    if (body?.incomplete_results) throw new Error(`GitHub search gave incomplete results for ${source.repo}`)
    if (Number(body?.total_count) > COLLECTION_LIMIT) return { status: "listed", listing: { overLimit: true } }

    for (const item of body?.items ?? []) issues.push(toIssue(source.repo, item))
    url = nextLink(response.headers.get("link"))
  }
  if (url) return { status: "listed", listing: { overLimit: true } }

  return { status: "listed", listing: { overLimit: false, items: issues } }
}

function issuesUrl(source: GithubIssuesSource): string {
  const query = new URLSearchParams({ state: "open", labels: source.labels.join(","), per_page: String(PAGE_SIZE) })
  if (source.assignee) query.set("assignee", source.assignee)
  if (source.author) query.set("creator", source.author)
  return `${API}/repos/${source.repo}/issues?${query}`
}

function searchQuery(source: GithubIssuesSource): string {
  const terms = [`repo:${source.repo}`, "is:issue", "is:open", ...source.labels.map((label) => `label:"${label}"`)]
  if (source.assignee) terms.push(`assignee:${source.assignee}`)
  if (source.author) terms.push(`author:${source.author}`)
  if (source.query) terms.push(source.query)
  return terms.join(" ")
}

function toIssue(repo: string, item: any): GithubIssue {
  return { repo, number: Number(item.number), title: String(item.title ?? ""), url: String(item.html_url ?? "") }
}

/** The `rel="next"` URL of a GitHub `Link` header. */
export function nextLink(header: string | null): string | undefined {
  if (!header) return undefined
  for (const part of header.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/)
    if (match) return match[1]
  }
  return undefined
}

async function githubBody(response: Response, url: string): Promise<any> {
  if (response.ok) return response.json()

  const detail = await response.text().catch(() => "")
  const path = url.replace(API, "")
  throw new Error(`GitHub ${response.status} for ${path}${detail ? `: ${detail.slice(0, 200)}` : ""}`)
}

async function githubFetch(url: string, headers: Record<string, string>): Promise<Response> {
  const token = githubToken()
  if (!token) throw new Error("GH_TOKEN or GITHUB_TOKEN is required for github-issues monitors")

  return fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      "user-agent": "sourcefed",
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...headers,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
}
