import { printResult } from "../../utils/format.ts"
import type { MonitorContext } from "./index.ts"

export async function events(context: MonitorContext): Promise<void> {
  printResult(await context.client.request("monitor.events", { target: context.target }))
}
