export type GithubEventShape = {
  kind: string
  id?: string
  summary: string
  body?: string
  actionable: boolean
}
