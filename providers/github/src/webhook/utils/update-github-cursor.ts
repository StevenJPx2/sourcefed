import * as v from "valibot"
import type { MonitorEvent } from "@sourcefed/core"
import { GithubCursorSchema } from "../../schema.ts"
import type { GithubCursor } from "../../types"
import { emptyGithubCursor } from "../../poll/utils/empty-cursor.ts"

export function updateGithubCursor(event: MonitorEvent, cursorRaw: unknown): GithubCursor {
  const parsed = v.safeParse(GithubCursorSchema, cursorRaw)
  let cursor = emptyGithubCursor()
  if (parsed.success) cursor = parsed.output

  if (event.id?.startsWith("review:")) {
    const id = `rev:${event.id.slice("review:".length)}`
    if (!cursor.reviewIds.includes(id)) cursor.reviewIds.push(id)
  }
  if (event.id?.startsWith("c:") || event.id?.startsWith("issue:")) {
    if (!cursor.commentIds.includes(event.id)) cursor.commentIds.push(event.id)
  }
  if (event.kind === "merged") cursor.prState = "MERGED"
  if (event.kind === "closed") cursor.prState = "CLOSED"
  if (event.kind === "conflict") cursor.mergeable = "CONFLICTING"
  return cursor
}
