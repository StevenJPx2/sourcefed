export interface YabEvent {
  kind: "entry"
  id: string
  at: string
  summary: string
  body?: string
  actionable: boolean
}
