/**
 * What an event is about, for programs: `key` names the item within its `type`
 * (`StevenJPx2/atelier#48`, `PROJ-7`, a schedule's job). Sources add their own
 * fields, such as `repo` and `number`.
 */
export type EventSubject = {
  type: string
  key: string
  url?: string
  title?: string
} & Record<string, unknown>
