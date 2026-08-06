import type { HttpServer, SourcefedDaemon } from "@sourcefed/daemon"
import { serveHttp } from "@sourcefed/daemon"

export async function startWebhookServer(runtime: SourcefedDaemon["runtime"]): Promise<HttpServer | undefined> {
  const enabled = Boolean(
    process.env.SOURCEFED_ENABLE_WEBHOOKS === "1" ||
    process.env.SOURCEFED_WEBHOOK_PORT ||
    process.env.SOURCEFED_GITHUB_WEBHOOK_SECRET ||
    process.env.SOURCEFED_SLACK_SIGNING_SECRET,
  )
  if (!enabled) return undefined

  try {
    return await serveHttp({
      hostname: process.env.SOURCEFED_WEBHOOK_HOST ?? "127.0.0.1",
      port: Number(process.env.SOURCEFED_WEBHOOK_PORT ?? 8788),
      handler: (request) => runtime.webhook(request),
    })
  } catch (error) {
    console.error(`[sourcefed] webhook listener unavailable; continuing with MCP and polling: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}
