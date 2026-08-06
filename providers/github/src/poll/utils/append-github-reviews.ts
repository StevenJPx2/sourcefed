import type { GithubCursor, GithubEvent } from "../../types"

export function appendGithubReviews(
  repo: string,
  prNumber: number,
  cursor: GithubCursor,
  events: GithubEvent[],
  reviews: any[],
  historyPrimed: boolean,
): void {
  const ref = `#${prNumber}`
  for (const review of reviews) {
    const id = "rev:" + String(review.id ?? `${review.author?.login}-${review.submittedAt}`)
    if (cursor.reviewIds.includes(id)) continue
    cursor.reviewIds.push(id)
    if (review.state === "PENDING" || !historyPrimed) continue
    if (!review.body?.trim()) continue
    let actionable = false
    if (review.state === "CHANGES_REQUESTED") actionable = true
    if (review.state === "COMMENTED" && review.body?.trim()) actionable = true
        events.push({
          kind: "review",
          id,
      repo,
      prNumber,
      at: review.submittedAt ?? new Date().toISOString(),
      summary: `Review by ${review.author?.login ?? "someone"} [${review.state}] on ${ref}`,
      body: review.body,
      actionable,
    })
  }
}
