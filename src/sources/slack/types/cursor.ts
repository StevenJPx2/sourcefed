export interface SlackCursor {
  primed: boolean
  messageIds: string[]
  latestTs?: string
}
