import { handleWebhook } from "./handle-webhook.ts"
import { setServer } from "./set-server.ts"
import { webhookState } from "./state.ts"
import type { Client } from "#sourcefed/types"

export function ensureWebhookServer(client: Client): void {
  if (webhookState.server) return
  const port = Number(process.env.SOURCEFED_WEBHOOK_PORT ?? 8787)
  const hostname = process.env.SOURCEFED_WEBHOOK_HOST ?? "0.0.0.0"
  const nextServer = Bun.serve({
    port,
    hostname,
    fetch: (request) => handleWebhook(request, client),
  })
  setServer(nextServer)
  console.log(`[sourcefed] webhook listener on ${hostname}:${nextServer.port}`)
}
