export interface GithubEvent {
  kind: "review" | "comment" | "ci" | "conflict" | "merged"
  id?: string
  repo: string
  prNumber: number
  at: string
  summary: string
  body?: string
  actionable: boolean
  terminal?: boolean
}
