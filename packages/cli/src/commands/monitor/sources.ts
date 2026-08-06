import { printResult } from "../../utils/format.ts"
import type { MonitorContext } from "./index.ts"

export async function sources(context: MonitorContext): Promise<void> {
  printResult(await context.client.request("daemon.sourceTypes"))
}
