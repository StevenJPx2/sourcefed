import { fetchSlackDm, fetchSlackThread } from "./slack-api.ts"
import { parseSlackReadResult } from "./parse-slack-read-result.ts"
import type { SlackCursor, SlackEvent, SlackSourceRecord } from "../../types"

export async function pollSlack(source: SlackSourceRecord, cursorRaw: unknown): Promise<{ events: SlackEvent[]; cursor: SlackCursor; terminal: false }> {
  const result = source.threadTs
    ? await fetchSlackThread(source.channelId, source.threadTs)
    : await fetchSlackDm(source.channelId)

  const parsed = parseSlackReadResult(result, cursorRaw, source.threadTs ? "thread" : "DM")
  return { ...parsed, terminal: false }
}
