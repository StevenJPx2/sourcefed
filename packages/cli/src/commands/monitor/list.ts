import type { MonitorView } from "@sourcefed/daemon"
import { printMonitors } from "../../utils/format.ts"
import type { MonitorContext } from "./index.ts"

export async function list(context: MonitorContext): Promise<void> {
  const result = (await context.client.request("monitor.list", { target: context.target })) as { ok?: boolean; monitors?: MonitorView[] }
  printMonitors(result?.monitors ?? [])
}
