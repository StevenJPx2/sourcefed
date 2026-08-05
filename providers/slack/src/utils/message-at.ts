import { messageTimestamp } from "./message-timestamp.ts"

export function messageAt(ts: string | undefined): string {
  const value = messageTimestamp(ts)
  if (value > 0) return new Date(value * 1000).toISOString()
  return new Date().toISOString()
}
