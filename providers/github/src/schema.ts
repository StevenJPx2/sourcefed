import * as v from "valibot"

export const GithubSourceSchema = v.object({
  type: v.literal("github"),
  repo: v.string(),
  prNumber: v.number(),
})

export const GithubCursorSchema = v.object({
  reviewIds: v.array(v.string()),
  commentIds: v.array(v.string()),
  historyPrimed: v.optional(v.boolean(), false),
  lineCommentsPrimed: v.optional(v.boolean(), false),
  conversationCommentsPrimed: v.optional(v.boolean(), false),
  ciState: v.string(),
  ciFailureState: v.optional(v.string(), ""),
  mergeable: v.string(),
  prState: v.string(),
})
