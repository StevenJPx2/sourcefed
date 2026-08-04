export interface SlackEvent {
  kind: "message"
  id?: string
  at: string
  summary: string
  body: string
  actionable: boolean
}
