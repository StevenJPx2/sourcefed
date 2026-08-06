import { dim, yellow } from "../../utils/format.ts"
import type { MonitorContext } from "./index.ts"

export async function follow(context: MonitorContext): Promise<void> {
  console.error(`[sourcefed] following events for ${context.target.kind}:${context.target.id}; Ctrl+C to stop`)
  const listener = await context.client.subscribe(context.target, async (events) => {
    for (const entry of events) {
      const time = dim(new Date(entry.event.at).toLocaleString())
      const marker = entry.event.actionable ? yellow("▶") : dim("·")
      console.log(`${marker} ${time} ${entry.event.summary}`)
      if (entry.event.body) console.log(dim(`    ${entry.event.body}`))
    }
  })
  await new Promise<void>(() => {})
  await listener.close()
}
