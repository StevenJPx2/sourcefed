import * as v from "valibot"

export const YabSourceSchema = v.object({
  type: v.literal("yab"),
  url: v.string(),
  space: v.optional(v.string()),
  match: v.optional(v.string()),
  exclude: v.optional(v.string()),
})

export const YabCursorSchema = v.object({
  primed: v.boolean(),
  seenIds: v.array(v.string()),
})
