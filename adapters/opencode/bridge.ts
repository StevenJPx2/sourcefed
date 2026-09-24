import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { connectDaemonClient, daemonCommand, daemonEnvironment, spawnLocalDaemon, type DaemonClient } from "@sourcefed/daemon"
import type { QueuedMonitorEvent } from "@sourcefed/core"
import { type Plugin, Rpc } from "@opencode/plugin"

type SessionDomain = Plugin.Context["session"]
type RpcDomain = Plugin.Context["rpc"]
type Target = { kind: "opencode-session"; id: string }

const GATE_TIMEOUT_MS = 3_000

/**
 * Chauffeur's gate, declared here so sourcefed does not depend on Chauffeur.
 * When the Chauffeur plugin runs in this OpenCode process, it decides which
 * events reach the session; otherwise every event is delivered.
 */
const ChauffeurGate = Rpc.define({
  id: "chauffeur",
  methods: {
    gate: {
      input: {
        type: "object",
        properties: {
          sessionID: { type: "string" },
          source: { type: "string" },
          kind: { type: "string" },
          summary: { type: "string" },
          body: { type: "string" },
          actionable: { type: "boolean" },
        },
        required: ["sessionID", "source", "kind", "summary", "actionable"],
      },
      output: {
        type: "object",
        properties: { deliver: { type: "boolean" } },
        required: ["deliver"],
      },
    },
  },
  events: {},
})

let activeBridge: OpenCodeBridge | undefined

export class OpenCodeBridge {
  private daemon?: DaemonClient
  private readonly listeners = new Map<string, { close(): Promise<void> }>()
  private lastAttemptAt = 0
  private lastError: string | undefined

  constructor(
    private readonly session: SessionDomain,
    private readonly rpc?: RpcDomain,
  ) {}

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

  // V2 `session.prompt` has no model field — the model is a session property and
  // prompting does not reset it, so no model-reuse dance is needed. Actionable
  // events prompt the agent; non-actionable ones inject a synthetic message that
  // lands in the transcript without triggering a reply.
  private async routeEvents(events: QueuedMonitorEvent[]): Promise<void> {
    for (const queued of events) {
      const sessionID = queued.target.id

      if (!(await this.admitted(sessionID, queued.event))) continue

      const text = eventText(queued.event)
      // Lets other plugins tell monitor events from the user's own words.
      const metadata = { sourcefed: { eventID: queued.id, monitorID: queued.monitorID, kind: queued.event.kind } }
      if (queued.event.actionable) {
        await this.session.prompt({ sessionID, text, metadata })
      } else {
        await this.session.synthetic({ sessionID, text, metadata })
      }
    }
  }

  /**
   * Ask Chauffeur's gate, when it runs in this process. Only an explicit
   * `deliver: false` withholds the event; no gate, an error, or a slow answer
   * delivers.
   */
  private async admitted(sessionID: string, event: QueuedMonitorEvent["event"]): Promise<boolean> {
    if (!this.rpc) return true

    try {
      const source = (event.source as { type?: unknown } | undefined)?.type
      const reply = await this.rpc(ChauffeurGate).gate(
        {
          sessionID,
          source: typeof source === "string" ? source : "unknown",
          kind: event.kind,
          summary: event.summary,
          body: event.body ?? "",
          actionable: event.actionable,
        },
        { signal: AbortSignal.timeout(GATE_TIMEOUT_MS) },
      )

      return (reply as { deliver?: unknown }).deliver !== false
    } catch {
      return true
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
