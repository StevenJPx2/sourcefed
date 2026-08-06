import type { LogEntryView } from "@sourcefed/daemon"
import { printLogs } from "../../utils/format.ts"
import type { MonitorContext } from "./index.ts"

export async function logs(context: MonitorContext): Promise<void> {
  const result = (await context.client.request("monitor.logs", { target: context.target })) as { logs?: LogEntryView[] }
  printLogs(result?.logs ?? [])
}
