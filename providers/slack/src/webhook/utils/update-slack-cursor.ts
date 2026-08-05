import * as v from "valibot"
import type { MonitorEvent } from "@sourcefed/core"
import { SlackCursorSchema } from "../../schema.ts"
import type { SlackCursor } from "../../types"
import { messageTimestamp } from "../../utils"

export function updateSlackCursor(event: MonitorEvent, cursorRaw: unknown): SlackCursor {
  const parsed = v.safeParse(SlackCursorSchema, cursorRaw)
  let cursor: SlackCursor = { primed: false, messageIds: [], latestTs: undefined }
  if (parsed.success) cursor = parsed.output
  if (event.id?.startsWith("message:")) {
    const messageId = event.id.slice("message:".length)
    if (!cursor.messageIds.includes(messageId)) cursor.messageIds.push(messageId)
    if (messageTimestamp(messageId) > messageTimestamp(cursor.latestTs)) cursor.latestTs = messageId
  }
  cursor.primed = true
  return cursor
}
