import * as v from "valibot"

export const JiraQuerySourceSchema = v.object({
  type: v.literal("jira-query"),
  jql: v.string(),
  includeExisting: v.optional(v.boolean()),
})

export type JiraQuerySource = v.InferOutput<typeof JiraQuerySourceSchema>
