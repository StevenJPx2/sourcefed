import * as v from "valibot"

export const JiraSourceSchema = v.object({
  type: v.literal("jira"),
  issueKey: v.string(),
})

export const JiraCursorSchema = v.object({
  commentIds: v.array(v.number()),
  descriptionVersion: v.optional(v.string()),
  changelogCount: v.number(),
})
