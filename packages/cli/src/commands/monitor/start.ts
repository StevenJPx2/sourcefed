import { flag } from "../../utils/flags.ts"
import { printResult } from "../../utils/format.ts"
import type { MonitorContext } from "./index.ts"

export async function start(context: MonitorContext): Promise<void> {
  const id = flag(context.args, "id")
  if (!id) throw new Error("start requires --id")
  printResult(await context.client.request("monitor.start", { target: context.target, id }))
}
