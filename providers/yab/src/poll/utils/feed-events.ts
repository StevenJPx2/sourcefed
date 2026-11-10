import * as v from "valibot"
import { YabCursorSchema } from "../../schema.ts"
import type { FeedEntry, YabCursor, YabEvent, YabSourceRecord } from "../../types"

// Feeds list at most a few hundred entries; remember enough that one dropping
// off and coming back (a mail marked unread again) is not new.
const SEEN_LIMIT = 1000

export function feedEvents(source: YabSourceRecord, entries: FeedEntry[], cursorRaw: unknown): { events: YabEvent[]; cursor: YabCursor } {
  const parsedCursor = v.safeParse(YabCursorSchema, cursorRaw)
  let previous: Partial<YabCursor> = {}
  if (parsedCursor.success) previous = parsedCursor.output
  const cursor: YabCursor = { primed: previous.primed ?? false, seenIds: previous.seenIds ?? [] }

  let events: YabEvent[] = []
  if (cursor.primed) {
    const seen = new Set(cursor.seenIds)
    const match = source.match ? new RegExp(source.match, "i") : undefined
    const exclude = source.exclude ? new RegExp(source.exclude, "i") : undefined
    events = entries
      .filter((entry) => !seen.has(entry.id))
      .filter((entry) => {
        const text = [entry.title, entry.summary, entry.author].filter(Boolean).join("\n")
        if (match && !match.test(text)) return false
        if (exclude && exclude.test(text)) return false
        return true
      })
      .sort((left, right) => (left.at && right.at ? left.at.localeCompare(right.at) : 0))
      .map(entryEvent)
  }

  cursor.primed = true
  cursor.seenIds = [...new Set([...cursor.seenIds, ...entries.map((entry) => entry.id)])].slice(-SEEN_LIMIT)
  return { events, cursor }
}

function entryEvent(entry: FeedEntry): YabEvent {
  const title = entry.title || "(untitled)"
  return {
    kind: "entry",
    id: `entry:${entry.id}`,
    at: entry.at ?? new Date().toISOString(),
    summary: entry.author ? `Yab feed entry from ${entry.author}: ${title}` : `Yab feed entry: ${title}`,
    body: [entry.summary, entry.link].filter(Boolean).join("\n\n") || undefined,
    actionable: true,
  }
}
