import { SOURCE_MAP } from "#sourcefed/sources"
import type { Monitor } from "#sourcefed/monitors"

export function sourceForWebhookPath(pathname: string): Monitor<any> | undefined {
  const sources = Object.values(SOURCE_MAP)
  for (const source of sources) {
    if (source.webhook?.path === pathname) return source
  }
  return undefined
}
