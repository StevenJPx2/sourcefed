import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { Readable } from "node:stream"

export type HttpServerOptions = {
  hostname: string
  port: number
  handler: (request: Request) => Promise<Response> | Response
}

export type HttpServer = {
  port: number
  stop(): Promise<void>
}

export async function serveHttp(options: HttpServerOptions): Promise<HttpServer> {
  const active = new Set<ServerResponse>()
  const server = createServer((incoming, outgoing) => {
    active.add(outgoing)
    outgoing.on("close", () => active.delete(outgoing))
    void handle(incoming, outgoing, options.handler)
  })
  // SSE connections (/events) are long-lived and idle; the Node default
  // requestTimeout (300s) kills them and the client logs "event stream ended:
  // terminated". Disable it so streams stay open until the client disconnects.
  server.requestTimeout = 0
  server.on("error", (error) => {
    console.error(`[sourcefed] http server error: ${error instanceof Error ? error.message : String(error)}`)
  })
  server.on("clientError", (_error, socket) => {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n")
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(options.port, options.hostname, () => resolve())
  })

  const address = server.address()
  const port = typeof address === "object" && address ? address.port : options.port

  return {
    port,
    async stop(): Promise<void> {
      for (const outgoing of active) {
        outgoing.destroy()
      }
      active.clear()
      server.closeIdleConnections?.()
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
    },
  }
}

async function handle(incoming: IncomingMessage, outgoing: ServerResponse, handler: (request: Request) => Promise<Response> | Response): Promise<void> {
  try {
    const response = await handler(toRequest(incoming))
    await writeResponse(outgoing, response)
  } catch (error) {
    console.error(`[sourcefed] request failed: ${error instanceof Error ? error.message : String(error)}`)
    if (!outgoing.headersSent) outgoing.writeHead(500, { "content-type": "text/plain" })
    outgoing.end("internal error")
  }
}

function toRequest(incoming: IncomingMessage): Request {
  const url = new URL(incoming.url ?? "/", `http://${incoming.headers.host ?? "localhost"}`)
  const method = incoming.method ?? "GET"
  const hasBody = method !== "GET" && method !== "HEAD"
  const headers = new Headers()
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item)
    } else {
      headers.set(name, value)
    }
  }
  const init = {
    method,
    headers,
    body: hasBody ? (Readable.toWeb(incoming) as ReadableStream) : undefined,
    duplex: "half" as const,
  }
  return new Request(url, init as RequestInit)
}

async function writeResponse(outgoing: ServerResponse, response: Response): Promise<void> {
  outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()))
  if (!response.body) {
    outgoing.end()
    return
  }
  const stream = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream)
  stream.on("error", (error) => {
    console.error(`[sourcefed] response stream error: ${error instanceof Error ? error.message : String(error)}`)
  })
  await new Promise<void>((resolve) => {
    let finished = false
    const done = () => {
      if (finished) return
      finished = true
      resolve()
    }
    outgoing.on("finish", done)
    outgoing.on("close", () => {
      stream.unpipe(outgoing)
      stream.destroy()
      done()
    })
    stream.pipe(outgoing)
  })
}
