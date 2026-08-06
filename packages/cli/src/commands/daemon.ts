import { handleDaemonHttpRequest, serveHttp } from "@sourcefed/daemon"
import { flag } from "../utils/flags.ts"
import { isLoopback } from "../utils/net.ts"
import { createDaemon } from "../utils/daemon.ts"
import { startWebhookServer } from "../utils/webhooks.ts"

export async function runDaemon(args: string[]): Promise<void> {
  const port = Number(flag(args, "port") ?? process.env.SOURCEFED_DAEMON_PORT ?? 18787)
  const hostname = flag(args, "host") ?? process.env.SOURCEFED_DAEMON_HOST ?? "127.0.0.1"
  const token = process.env.SOURCEFED_DAEMON_TOKEN
  if (!isLoopback(hostname) && !token) {
    throw new Error("binding the daemon to a non-loopback address requires SOURCEFED_DAEMON_TOKEN")
  }
  const daemon = createDaemon()
  await daemon.start()
  let server
  try {
    server = await serveHttp({
      hostname,
      port,
      handler: (request) => handleDaemonHttpRequest(daemon, request, { token }),
    })
    const webhookServer = await startWebhookServer(daemon.runtime)
    console.error(webhookServer ? `[sourcefed] webhook listener on http://${process.env.SOURCEFED_WEBHOOK_HOST ?? "127.0.0.1"}:${webhookServer.port}` : "[sourcefed] no separate webhook listener (webhooks served on daemon port)")
  } catch (error) {
    await daemon.stop()
    throw error
  }
  console.error(`[sourcefed] daemon on http://${hostname}:${server.port} (rpc, events, webhooks)`)
  await new Promise<void>(() => {})
}
