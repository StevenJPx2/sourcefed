import { fetchSlackThread } from "./slack-api.ts"
import { parseSlackReadResult } from "./parse-slack-read-result.ts"
import type { SlackCursor, SlackEvent, SlackSourceRecord } from "../../types"

export async function pollSlack(source: SlackSourceRecord, cursorRaw: unknown): Promise<{ events: SlackEvent[]; cursor: SlackCursor; terminal: false }> {
  const result = await fetchSlackThread(source.channelId, source.threadTs)
  if (!result) throw new Error("slack API request failed; check SOURCEFED_SLACK_TOKEN")
  const parsed = parseSlackReadResult(result, cursorRaw)
  return { ...parsed, terminal: false }
}
