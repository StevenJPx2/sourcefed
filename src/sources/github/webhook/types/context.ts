export type GithubWebhookContext = {
  payload: any
  actor: string
  repo: string
  prNumber: number
  eventName: string
}
