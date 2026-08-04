import type { MonitorContext } from "#sourcefed/types"
import type { Monitor } from "../../monitor"

export async function tick(context: MonitorContext): Promise<void> {
  const monitors = await context.service.list()
  for (const record of monitors) {
    if (!record.enabled) continue
    const source = context.sources[record.source.type] as Monitor | undefined
    if (!source) {
      console.error(`[sourcefed] no monitor provider for source type ${record.source.type}`)
      continue
    }
    try {
      await source.tick(context, record)
    } catch (error) {
      console.error(`[sourcefed] monitor ${record.id} poll failed:`, error)
      await context.service.updateCursor(record, "__lastPolledAt", Date.now()).catch((updateError) => {
        console.error(`[sourcefed] monitor ${record.id} poll timestamp update failed:`, updateError)
      })
    }
  }
}
