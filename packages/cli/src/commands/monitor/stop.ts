import { flag } from "../../utils/flags.ts"
import { printResult } from "../../utils/format.ts"
import type { MonitorContext } from "./index.ts"

export async function stop(context: MonitorContext): Promise<void> {
  const id = flag(context.args, "id")
  if (!id) throw new Error("stop requires --id")
  printResult(await context.client.request("monitor.stop", { target: context.target, id }))
}
