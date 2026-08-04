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

const SlackMessageSchema = v.object({
  ts: v.optional(v.string()),
  thread_ts: v.optional(v.string()),
  user: v.optional(v.string()),
  text: v.optional(v.string()),
})

export const SlackReadResultSchema = v.object({
  messages: v.optional(v.array(SlackMessageSchema)),
  users: v.optional(v.array(v.object({
    id: v.optional(v.string()),
    name: v.optional(v.string()),
    real_name: v.optional(v.string()),
  }))),
})
