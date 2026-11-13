import * as v from "valibot"
import { COLLECTION_LIMIT, PollMonitor, compareCollection, toMonitorEvent, type SourceEvent } from "@sourcefed/core"
import { listIssues, type GithubFetch } from "./api.ts"
import { issueKey, limitEvent, matchedEvent, unmatchedEvent } from "./events.ts"
import { GithubIssuesCursorSchema, type GithubIssuesCursor, type GithubIssuesSource } from "./schema.ts"

export type GithubIssuesPoll = { cursor: unknown; events: SourceEvent[] }

/** One poll: list the matching issues and compare their keys with the cursor's. */
export async function pollGithubIssues(
  source: GithubIssuesSource,
  cursorRaw: unknown,
  request?: GithubFetch,
  now: () => Date = () => new Date(),
): Promise<GithubIssuesPoll> {
  const parsed = v.safeParse(GithubIssuesCursorSchema, cursorRaw)
  const etag = parsed.success ? parsed.output.etag : undefined

  const result = await listIssues(source, etag, request)
  if (result.status === "unchanged") return { cursor: cursorRaw, events: [] }

  const changes = compareCollection(cursorRaw, result.listing, issueKey, source.includeExisting ?? false)
  const at = now().toISOString()
  const events = [
    ...changes.unmatched.map((key) => unmatchedEvent(source, key, at)),
    ...changes.matched.map((issue) => matchedEvent(source, issue, at)),
  ]
  if (changes.reachedLimit) events.push(limitEvent(source, COLLECTION_LIMIT, at))

  const cursor: GithubIssuesCursor = { ...changes.cursor }
  if (result.etag) cursor.etag = result.etag
  return { cursor, events }
}

export const githubIssuesPollMonitor = new PollMonitor<GithubIssuesSource>({
  run: async (source, cursor) => {
    const result = await pollGithubIssues(source, cursor)
    return {
      cursor: result.cursor,
      events: result.events.map((event) => toMonitorEvent(event, source)),
      terminal: false,
    }
  },
})
