import { COLLECTION_LIMIT, PollMonitor, compareCollection, toMonitorEvent, type SourceEvent } from "@sourcefed/core"
import { searchIssues, type JiraFetch, type JiraIssue } from "./api.ts"
import { limitEvent, matchedEvent, unmatchedEvent } from "./events.ts"
import type { JiraQuerySource } from "./schema.ts"

/** One poll: search the JQL and compare the matching keys with the cursor's. */
export async function pollJiraQuery(
  source: JiraQuerySource,
  cursorRaw: unknown,
  request?: JiraFetch,
  now: () => Date = () => new Date(),
): Promise<{ cursor: unknown; events: SourceEvent[] }> {
  const listing = await searchIssues(source.jql, request)
  const changes = compareCollection(cursorRaw, listing, (issue: JiraIssue) => issue.key, source.includeExisting ?? false)

  const at = now().toISOString()
  const events = [
    ...changes.unmatched.map((key) => unmatchedEvent(source.jql, key, at)),
    ...changes.matched.map((issue) => matchedEvent(source.jql, issue, at)),
  ]
  if (changes.reachedLimit) events.push(limitEvent(source.jql, COLLECTION_LIMIT, at))
  return { cursor: changes.cursor, events }
}

export const jiraQueryPollMonitor = new PollMonitor<JiraQuerySource>({
  run: async (source, cursor) => {
    const result = await pollJiraQuery(source, cursor)
    return {
      cursor: result.cursor,
      events: result.events.map((event) => toMonitorEvent(event, source)),
      terminal: false,
    }
  },
})
