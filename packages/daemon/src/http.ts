import type { MonitorTarget } from "@sourcefed/core"
import type { SourcefedDaemon } from "./daemon.ts"
import { dispatchDaemonRequest } from "./dispatch.ts"
import { decodeTarget } from "./utils"

export type DaemonHttpOptions = {
  token?: string
}

export async function handleDaemonHttpRequest(daemon: SourcefedDaemon, request: Request, options: DaemonHttpOptions = {}): Promise<Response> {
  const url = new URL(request.url)

  if (url.pathname === "/rpc" || url.pathname === "/events") {
    if (!authorized(request, options.token)) return new Response("unauthorized", { status: 401 })
  }

  if (url.pathname === "/rpc" && request.method === "POST") {
    let parsed: unknown
    try {
      parsed = await request.json()
    } catch {
      return Response.json({ error: "invalid json" }, { status: 400 })
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || typeof (parsed as { method?: unknown }).method !== "string") {
      return Response.json({ error: "invalid request" }, { status: 400 })
    }
    const body = parsed as { id?: number; method: string; params?: Record<string, unknown> }
    try {
      const result = await dispatchDaemonRequest(daemon, body.method, body.params ?? {})
      return Response.json({ id: body.id, result })
    } catch (error) {
      return Response.json({ id: body.id, error: error instanceof Error ? error.message : String(error) }, { status: 400 })
    }
  }

  if (url.pathname === "/events" && request.method === "GET") {
    const target = decodeTarget(url.searchParams.get("target") ?? "")
    if (!target) return new Response("invalid target", { status: 400 })
    return eventStream(daemon, target)
  }

  return daemon.webhook(request)
}

function authorized(request: Request, token: string | undefined): boolean {
  if (!token) return true
  return request.headers.get("authorization") === `Bearer ${token}`
}

function eventStream(daemon: SourcefedDaemon, target: MonitorTarget): Response {
  let unsubscribe: (() => void) | undefined
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      unsubscribe = daemon.subscribe(target, (events) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "event", target, events })}\n\n`))
      })
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "subscribed", target })}\n\n`))
    },
    cancel() {
      unsubscribe?.()
    },
  })
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  })
}
