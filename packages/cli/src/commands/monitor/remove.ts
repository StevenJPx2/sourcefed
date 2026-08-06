import { flag } from "../../utils/flags.ts"
import { printResult } from "../../utils/format.ts"
import type { MonitorContext } from "./index.ts"

export async function remove(context: MonitorContext): Promise<void> {
  if (!context.args.includes("--yes")) throw new Error("remove is destructive: pass --yes to confirm")
  const id = flag(context.args, "id")
  if (!id) throw new Error("remove requires --id")
  printResult(await context.client.request("monitor.remove", { target: context.target, id }))
}
