import { deliverWebhook } from "./deliver-webhook.ts"
import { heartbeatWebhooks } from "./heartbeat-webhooks.ts"
import type { MonitorContext } from "#sourcefed/types"

const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024

export async function handleWebhook(request: Request, context: MonitorContext): Promise<Response> {
  const source = context.sourceForWebhookPath(new URL(request.url).pathname)
  if (!source || !source.webhook) return new Response("not found", { status: 404 })
  const body = await readBody(request)
  if (body === undefined) return new Response("payload too large", { status: 413 })
  if (!source.webhook.verify(body, request)) return new Response("invalid signature", { status: 401 })
  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    return new Response("invalid json", { status: 400 })
  }
  const challenge = source.webhook.challenge?.(payload)
  if (challenge) return Response.json(challenge)
  const deliveryId = source.webhook.deliveryId(request, payload)
  if (!deliveryId) return new Response("missing delivery id", { status: 400 })
  const eventName = source.webhook.eventName(request, payload)
  const event = source.webhook.parse(payload, eventName, deliveryId)
  if (!event) return new Response("ignored", { status: 202 })
  void heartbeatWebhooks(context, source, event.source).catch((error) => console.error("[sourcefed] webhook heartbeat failed:", error))
  if (source.webhook.acknowledgeBeforeDelivery) {
    void deliverWebhook(context, source, event, deliveryId).catch((error) => console.error("[sourcefed] webhook delivery failed:", error))
    return new Response("accepted", { status: 202 })
  }
  await deliverWebhook(context, source, event, deliveryId)
  return new Response("ok")
}

async function readBody(request: Request): Promise<string | undefined> {
  const contentLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BODY_BYTES) return undefined
  const reader = request.body?.getReader()
  if (!reader) return ""
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_WEBHOOK_BODY_BYTES) {
        await reader.cancel()
        return undefined
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}
