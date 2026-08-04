import { deliverWebhook } from "./deliver-webhook.ts"
import { heartbeatWebhooks } from "./heartbeat-webhooks.ts"
import type { MonitorContext } from "#sourcefed/types"

export async function handleWebhook(request: Request, context: MonitorContext): Promise<Response> {
  const source = context.sourceForWebhookPath(new URL(request.url).pathname)
  if (!source || !source.webhook) return new Response("not found", { status: 404 })
  const body = await request.text()
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
