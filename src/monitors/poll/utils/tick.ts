import type { Client } from "#sourcefed/types"
import { sourceDefinition } from "#sourcefed/source-utils"
import { listMonitors, updateCursor } from "../../utils"
import type { Monitor } from "../../monitor"

export async function tick(client: Client): Promise<void> {
  const monitors = await listMonitors()
  for (const record of monitors) {
    if (!record.enabled) continue
    const source: Monitor = sourceDefinition(record.source)
    try {
      await source.tick(client, record)
    } catch (error) {
      console.error(`[sourcefed] monitor ${record.id} poll failed:`, error)
      await updateCursor(record, "__lastPolledAt", Date.now()).catch((updateError) => {
        console.error(`[sourcefed] monitor ${record.id} poll timestamp update failed:`, updateError)
      })
    }
  }
}
