import type { MonitorEvent } from "#sourcefed/types"

export function eventToText(event: MonitorEvent): string {
  const summary = event.summary.trim()
  let detail = ""
  if (event.kind !== "merged" && event.body) detail = event.body.trim()

  let duplicateDetail = detail
  if (detail && summary.includes(detail)) duplicateDetail = ""

  const lines = [`[sourcefed monitor] ${summary}`]
  if (duplicateDetail) lines.push(`\n${duplicateDetail}`)
  return lines.filter(Boolean).join("\n")
}
