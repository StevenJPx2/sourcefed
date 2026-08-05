import * as v from "valibot"

export const SlackSourceSchema = v.object({
  type: v.literal("slack"),
  channelId: v.string(),
  threadTs: v.string(),
})

export const SlackCursorSchema = v.object({
  primed: v.boolean(),
  messageIds: v.array(v.string()),
  latestTs: v.optional(v.string()),
})

