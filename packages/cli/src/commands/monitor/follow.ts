import { once } from "node:events"
import type { QueuedMonitorEvent } from "@sourcefed/core"
import { dim, yellow } from "../../utils/format.ts"
import type { MonitorContext } from "./index.ts"

/**
 * Print each event as it arrives. Plain output acknowledges what it printed;
 * `--json` prints one queued event per line and leaves acknowledgement to the
 * reader (`monitor ack`), so an event it never handled comes again next time.
 */
export async function follow(context: MonitorContext): Promise<void> {
  const json = context.args.includes("--json")
  console.error(`[sourcefed] following events for ${context.target.kind}:${context.target.id}; Ctrl+C to stop`)
  const listener = await context.client.subscribe(context.target, async (events) => {
    for (const entry of events) {
      if (json) await writeLine(JSON.stringify(entry))
      else printEvent(entry)
    }
  }, { acknowledge: !json })
  await new Promise<void>(() => {})
  await listener.close()
}

function printEvent(entry: QueuedMonitorEvent): void {
  const time = dim(new Date(entry.event.at).toLocaleString())
  const marker = entry.event.actionable ? yellow("▶") : dim("·")
  console.log(`${marker} ${time} ${entry.event.summary}`)
  if (entry.event.body) console.log(dim(`    ${entry.event.body}`))
}

// Waiting for a slow reader holds back the stream instead of buffering without bound.
async function writeLine(line: string): Promise<void> {
  if (!process.stdout.write(`${line}\n`)) await once(process.stdout, "drain")
}
