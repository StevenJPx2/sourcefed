import { flags } from "../../utils/flags.ts"
import { printResult } from "../../utils/format.ts"
import type { MonitorContext } from "./index.ts"

// Repeat the flag for several events. Event IDs can contain commas (a CI event
// names its failed checks), so a comma-separated list cannot be split safely.
export async function ack(context: MonitorContext): Promise<void> {
  const eventIDs = flags(context.args, "event-id").filter(Boolean)
  if (eventIDs.length === 0) throw new Error("ack requires --event-id <id> (repeat it for several events)")
  printResult(await context.client.request("monitor.ack", { target: context.target, eventIDs }))
}
