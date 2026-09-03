import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { connectDaemonClient, daemonCommand, daemonEnvironment, spawnLocalDaemon, type DaemonClient } from "@sourcefed/daemon"
import type { QueuedMonitorEvent } from "@sourcefed/core"
import type { createOpencodeClient } from "@opencode-ai/sdk"

type OpenCodeClient = ReturnType<typeof createOpencodeClient>
type Target = { kind: "opencode-session"; id: string }

let activeBridge: OpenCodeBridge | undefined

export class OpenCodeBridge {
  private daemon?: DaemonClient
  private readonly listeners = new Map<string, { close(): Promise<void> }>()
  private lastAttemptAt = 0
  private lastError: string | undefined

  constructor(private readonly opencode: OpenCodeClient) {}

  async start(): Promise<void> {
    await this.ensureDaemon()
  }

  async ensureTarget(sessionID: string): Promise<void> {
    await this.ensureDaemon()
    if (this.listeners.has(sessionID)) return
    const target = this.target(sessionID)
    const listener = await this.daemon!.subscribe(target, async (events) => {
      await this.routeEvents(events)
    })
    this.listeners.set(sessionID, listener)
  }

  async callTool(name: string, arguments_: Record<string, unknown>, sessionID: string): Promise<unknown> {
    await this.ensureDaemon()
    if (!this.daemon) {
      return { ok: false, error: `sourcefed daemon unavailable: ${this.lastError ?? "not started"}` }
    }
    await this.ensureTarget(sessionID)
    return this.daemon.request(name.replace(/_/g, "."), { ...arguments_, target: this.target(sessionID) })
  }

  async close(): Promise<void> {
    for (const listener of this.listeners.values()) await listener.close()
    this.listeners.clear()
    await this.daemon?.close()
    this.daemon = undefined
  }

  private async ensureDaemon(): Promise<void> {
    if (this.daemon) return
    if (Date.now() - this.lastAttemptAt < 15_000) return
    this.lastAttemptAt = Date.now()
    try {
      const url = process.env.SOURCEFED_DAEMON_URL
      if (url) {
        this.daemon = await connectDaemonClient({ name: "sourcefed-opencode", url })
        return
      }
      const local = daemonCommand(cliEntry())
      const spawned = await spawnLocalDaemon({
        command: local.command,
        args: local.args,
        env: daemonEnvironment(),
      })
      this.daemon = await connectDaemonClient({ name: "sourcefed-opencode", url: spawned.url })
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      console.error(`[sourcefed] daemon unavailable: ${this.lastError}`)
    }
  }

  private async routeEvents(events: QueuedMonitorEvent[]): Promise<void> {
    for (const queued of events) {
      const body = {
        ...(queued.event.actionable ? {} : { noReply: true }),
        parts: [{ type: "text" as const, text: eventText(queued.event) }],
      }
      await this.opencode.session.prompt({ path: { id: queued.target.id }, body })
    }
  }

  private target(sessionID: string): Target {
    return { kind: "opencode-session", id: sessionID }
  }
}

function cliEntry(): string {
  const bundled = fileURLToPath(new URL("./cli.js", import.meta.url))
  if (existsSync(bundled)) return bundled
  return fileURLToPath(import.meta.resolve("@sourcefed/cli"))
}

export function setOpenCodeBridge(bridge: OpenCodeBridge): void {
  activeBridge = bridge
}

export function getOpenCodeBridge(): OpenCodeBridge {
  if (!activeBridge) throw new Error("Sourcefed OpenCode bridge is not initialized")
  return activeBridge
}

function eventText(event: QueuedMonitorEvent["event"]): string {
  const header = `[sourcefed monitor] ${event.summary}`
  return event.body ? `${header}\n\n${event.body}` : header
}
