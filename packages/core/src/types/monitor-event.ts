import type { EventSubject } from "./event-subject.ts"

export type MonitorEvent = {
  source: unknown
  kind: string
  id?: string
  at: string
  summary: string
  body?: string
  actionable: boolean
  terminal?: boolean
  subject?: EventSubject
}
