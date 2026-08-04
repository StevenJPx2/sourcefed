import type { SlackMessage } from "./message.ts"

export interface SlackUser {
  id?: string
  name?: string
  real_name?: string
}

export interface SlackReadResult {
  messages?: SlackMessage[]
  users?: SlackUser[]
}
