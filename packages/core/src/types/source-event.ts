export type SourceEvent = {
  kind: string
  id?: string
  at: string
  summary: string
  body?: string
  actionable: boolean
  terminal?: boolean
}
