import { serveStdio } from "@modelcontextprotocol/server/stdio"
import { serveHttp } from "@sourcefed/daemon"
import { createSourcefedMcp, createSourcefedStdio } from "@sourcefed/mcp"
import { flag } from "../utils/flags.ts"
import { isLoopback } from "../utils/net.ts"
import { createDaemon } from "../utils/daemon.ts"
import { startWebhookServer } from "../utils/webhooks.ts"

export async function runMcp(args: string[]): Promise<void> {
  const mode = args[0] ?? "--stdio"
  if (mode === "--stdio") {
    const daemon = createDaemon()
    const mcp = createSourcefedStdio(daemon)
    await daemon.start()
    const webhookServer = await startWebhookServer(mcp.runtime)
    await serveStdio(mcp.factory)
    await webhookServer?.stop()
    await mcp.close()
    return
  }

  if (mode !== "--http") {
    throw new Error("mcp expects --stdio or --http")
  }

  const port = Number(flag(args, "port") ?? process.env.SOURCEFED_MCP_PORT ?? 18788)
  const hostname = flag(args, "host") ?? process.env.SOURCEFED_MCP_HOST ?? "127.0.0.1"
  const token = process.env.SOURCEFED_DAEMON_TOKEN
  if (!isLoopback(hostname) && !token) {
    throw new Error("binding the MCP server to a non-loopback address requires SOURCEFED_DAEMON_TOKEN")
  }
  const daemon = createDaemon()
  const mcp = createSourcefedMcp(daemon)
  await daemon.start()
  let server
  try {
    server = await serveHttp({
      hostname,
      port,
      handler: (request) => {
        const url = new URL(request.url)
        if (url.pathname === "/mcp" && token && request.headers.get("authorization") !== `Bearer ${token}`) {
          return new Response("unauthorized", { status: 401 })
        }
        return url.pathname === "/mcp" ? mcp.handler.fetch(request) : daemon.webhook(request)
      },
    })
  } catch (error) {
    await mcp.close()
    throw error
  }
  console.error(`[sourcefed] MCP server on http://${hostname}:${server.port}/mcp`)
  await new Promise<void>(() => {})
}
