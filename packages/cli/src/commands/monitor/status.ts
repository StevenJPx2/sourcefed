import { flag } from "../../utils/flags.ts"
import { printResult } from "../../utils/format.ts"
import type { MonitorContext } from "./index.ts"

export async function status(context: MonitorContext): Promise<void> {
  const id = flag(context.args, "id")
  if (!id) throw new Error("status requires --id")
  printResult(await context.client.request("monitor.status", { target: context.target, id }))
}
