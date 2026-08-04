import type { MonitorRecord } from "#sourcefed/monitors"
import type { MonitorEvent } from "#sourcefed/types"
import { eventToText } from "./event-to-text.ts"

import type { Client } from "#sourcefed/types"

export async function routeToSession(
  client: Client,
  monitor: MonitorRecord,
  event: MonitorEvent,
): Promise<{ ok: boolean; error?: string }> {
  const text = eventToText(event)
  try {
    let body: { noReply?: boolean; parts: [{ type: "text"; text: string }] }
    if (event.actionable) {
      body = { parts: [{ type: "text", text }] }
    } else {
      body = { noReply: true, parts: [{ type: "text", text }] }
    }
    await client.session.prompt({ path: { id: monitor.sessionID }, body })
    return { ok: true }
  } catch (err) {
    let error = String(err)
    if (err instanceof Error) error = err.message
    return { ok: false, error }
  }
}
