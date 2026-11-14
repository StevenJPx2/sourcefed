import * as v from "valibot"
import type { SourcePollDeferred } from "@sourcefed/core"
import { SlackCursorSchema } from "../../schema.ts"
import { fetchSlackDm, fetchSlackThread } from "./slack-api.ts"
import { parseSlackReadResult } from "./parse-slack-read-result.ts"
import type { SlackCursor, SlackEvent, SlackSourceRecord } from "../../types"

export type SlackPollRead = { events: SlackEvent[]; cursor: SlackCursor; terminal: false }

export async function pollSlack(source: SlackSourceRecord, cursorRaw: unknown, monitorId: string): Promise<SlackPollRead | SourcePollDeferred> {
  // A primed monitor asks only for messages after the newest it has seen: those are the
  // only ones the cursor can count as new, and usually they fit on the first page.
  const cursor = v.safeParse(SlackCursorSchema, cursorRaw)
  const primed = cursor.success && cursor.output.primed
  const after = primed ? cursor.output.latestTs : undefined
  const request = { monitorId, first: !primed, ...(after ? { after } : {}) }
  const result = source.threadTs
    ? await fetchSlackThread(source.channelId, source.threadTs, request)
    : await fetchSlackDm(source.channelId, request)
  if ("deferred" in result) return result

  const parsed = parseSlackReadResult(result, cursorRaw, source.threadTs ? "thread" : "DM")
  return { ...parsed, terminal: false }
}
