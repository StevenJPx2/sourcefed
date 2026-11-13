import * as v from "valibot"
import { CollectionCursorSchema } from "@sourcefed/core"

export const GithubIssuesSourceSchema = v.object({
  type: v.literal("github-issues"),
  repo: v.string(),
  labels: v.array(v.string()),
  assignee: v.optional(v.string()),
  author: v.optional(v.string()),
  query: v.optional(v.string()),
  includeExisting: v.optional(v.boolean()),
})

export type GithubIssuesSource = v.InferOutput<typeof GithubIssuesSourceSchema>

export const GithubIssuesCursorSchema = v.object({
  ...CollectionCursorSchema.entries,
  etag: v.optional(v.string()),
})

export type GithubIssuesCursor = v.InferOutput<typeof GithubIssuesCursorSchema>
