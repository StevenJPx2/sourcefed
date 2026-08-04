import * as v from "valibot"
import { SlackCursorSchema } from "../../schema.ts"
import type { SlackCursor, SlackEvent, SlackReadResult } from "../../types"
import { messageAt, messageTimestamp } from "../../utils"

export function parseSlackReadResult(result: SlackReadResult, cursorRaw: unknown): { events: SlackEvent[]; cursor: SlackCursor } {
  const parsedCursor = v.safeParse(SlackCursorSchema, cursorRaw)
  let previous: Partial<SlackCursor> = {}
  if (parsedCursor.success) previous = parsedCursor.output
  const cursor: SlackCursor = {
    primed: previous.primed ?? false,
    messageIds: previous.messageIds ?? [],
    latestTs: previous.latestTs,
  }
  const users = new Map((result.users ?? []).map((user) => [user.id, user.real_name ?? user.name ?? user.id ?? "someone"]))
  const messages = (result.messages ?? []).filter((message) => message.ts)
  const freshMessages = messages.filter((message) => {
    if (cursor.messageIds.includes(message.ts!)) return false
    if (!cursor.latestTs) return true
    return messageTimestamp(message.ts) > messageTimestamp(cursor.latestTs)
  })
  let events: SlackEvent[] = []
  if (cursor.primed) {
    events = freshMessages.map((message) => {
      let text = "[message without text]"
      if (message.text?.trim()) text = message.text.trim()
      let author = users.get(message.user)
      if (!author) author = message.user
      if (!author) author = "someone"
      return {
        kind: "message",
        id: `message:${message.ts}`,
        at: messageAt(message.ts),
        summary: `Slack thread message by ${author}`,
        body: text,
        actionable: true,
      }
    })
  }

  cursor.primed = true
  cursor.messageIds = [...new Set([...cursor.messageIds, ...messages.map((message) => message.ts!)])].slice(-500)
  let latestTs = cursor.latestTs
  for (const message of messages) {
    if (messageTimestamp(message.ts) > messageTimestamp(latestTs)) latestTs = message.ts
  }
  cursor.latestTs = latestTs
  return { events, cursor }
}
