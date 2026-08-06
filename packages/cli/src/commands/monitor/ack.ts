import { flag } from "../../utils/flags.ts"
import { printResult } from "../../utils/format.ts"
import type { MonitorContext } from "./index.ts"

export async function ack(context: MonitorContext): Promise<void> {
  const eventIDs = (flag(context.args, "event-id") ?? "").split(",").filter(Boolean)
  if (eventIDs.length === 0) throw new Error("ack requires --event-id <id>[,<id>...]")
  printResult(await context.client.request("monitor.ack", { target: context.target, eventIDs }))
}
