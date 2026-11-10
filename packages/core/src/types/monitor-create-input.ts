export type MonitorCreateInput = {
  issueKey?: string
  repo?: string
  prNumber?: number
  channelId?: string
  threadTs?: string
  threadUrl?: string
  url?: string
  space?: string
  match?: string
  exclude?: string
}
