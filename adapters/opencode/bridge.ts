import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { connectDaemonClient, daemonCommand, daemonEnvironment, spawnLocalDaemon, type DaemonClient } from "@sourcefed/daemon"
import { eventToText, type QueuedMonitorEvent } from "@sourcefed/core"
import { type Plugin, Rpc } from "@opencode/plugin"
import { OpenCodeSubscriptions, type SessionLocation } from "./subscriptions.ts"

type SessionDomain = Plugin.Context["session"]
// The bridge calls only this contract; registration and event APIs belong to the host.
type RpcDomain = (definition: typeof ChauffeurGate) => {
  gate(input: unknown, options: { signal: AbortSignal }): Promise<unknown>
}
const TARGET_KIND = "opencode-session"
type Target = { kind: typeof TARGET_KIND; id: string }

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
          // The monitor that produced the event, so the gate knows what it watches.
          monitorID: { type: "string" },
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

const HUB = Symbol.for("sourcefed.opencode.subscriptions.v1")
// Plugin reloads can evaluate another copy of this module in the same process.
const shared = globalThis as typeof globalThis & { [HUB]?: OpenCodeSubscriptions }

function subscriptions(): OpenCodeSubscriptions {
  if (!shared[HUB] || shared[HUB].closed) shared[HUB] = new OpenCodeSubscriptions(connectDaemon)
  return shared[HUB]
}

export class OpenCodeBridge {
  private started: Promise<void> | undefined
  private closed = false
  private closing: Promise<void> | undefined

  constructor(
    private readonly session: Pick<SessionDomain, "get" | "synthetic">,
    private readonly rpc: RpcDomain | undefined,
    readonly location: SessionLocation,
    private readonly hub = subscriptions(),
  ) {}

  /**
   * Chauffeur or the CLI can create a monitor for a session here at any time,
   * without this bridge's tools, so check for new targets periodically too.
   */
  async start(): Promise<void> {
    if (this.closed) throw new Error("sourcefed bridge is closed")
    this.started ??= this.hub.add(this)
    await this.started
  }

  async callTool(name: string, arguments_: Record<string, unknown>, sessionID: string): Promise<unknown> {
    try {
      await this.start()
      const method = name.replace(/_/g, ".")
      const result = await this.hub.request(method, { ...arguments_, target: this.target(sessionID) })
      // Only mutations can change subscription demand. Reads never open streams.
      if (["monitor.create", "monitor.start", "monitor.stop", "monitor.remove"].includes(method)) await this.hub.refresh()
      return result
    } catch (error) {
      return { ok: false, error: String(error) }
    }
  }

  close(): Promise<void> {
    if (this.closing) return this.closing
    this.closed = true
    this.closing = this.started ? this.hub.remove(this) : Promise.resolve()
    return this.closing
  }

  async refresh(): Promise<void> {
    if (!this.closed) await this.hub.refresh()
  }

  getSession(sessionID: string, signal: AbortSignal) {
    return this.session.get({ sessionID }, { signal: AbortSignal.any([signal, AbortSignal.timeout(3_000)]) })
  }

  // Every event arrives as a synthetic message, never as a user prompt, so it is
  // not mistaken for the user's own words. Actionable events resume an idle
  // agent; the rest wait in the transcript for the next turn.
  async routeEvents(events: QueuedMonitorEvent[]): Promise<void> {
    for (const queued of events) {
      const sessionID = queued.target.id

      if (!(await this.admitted(sessionID, queued))) continue

      await this.session.synthetic({
        sessionID,
        text: eventToText(queued.event),
        description: `sourcefed ${queued.event.kind}`,
        metadata: { sourcefed: { eventID: queued.id, monitorID: queued.monitorID, kind: queued.event.kind } },
        resume: queued.event.actionable,
      })
    }
  }

  /**
   * Ask Chauffeur's gate, when it runs in this process. Only an explicit
   * `deliver: false` withholds the event; no gate, an error, or a slow answer
   * delivers.
   */
  private async admitted(sessionID: string, queued: QueuedMonitorEvent): Promise<boolean> {
    if (!this.rpc) return true

    const { event } = queued

    try {
      const source = (event.source as { type?: unknown } | undefined)?.type
      const reply = await this.rpc(ChauffeurGate).gate(
        {
          sessionID,
          monitorID: queued.monitorID,
          source: typeof source === "string" ? source : "unknown",
          kind: event.kind,
          summary: event.summary,
          body: event.body ?? "",
          actionable: event.actionable,
        },
        { signal: AbortSignal.timeout(GATE_TIMEOUT_MS) },
      )

      return !(reply && typeof reply === "object" && "deliver" in reply && reply.deliver === false)
    } catch {
      return true
    }
  }

  private target(sessionID: string): Target {
    return { kind: TARGET_KIND, id: sessionID }
  }
}

async function connectDaemon(): Promise<DaemonClient> {
  const url = process.env.SOURCEFED_DAEMON_URL
  if (url) return connectDaemonClient({ name: "sourcefed-opencode", url })
  const local = daemonCommand(cliEntry())
  const spawned = await spawnLocalDaemon({
    command: local.command,
    args: local.args,
    env: daemonEnvironment(),
  })
  return connectDaemonClient({ name: "sourcefed-opencode", url: spawned.url })
}

function cliEntry(): string {
  const bundled = fileURLToPath(new URL("./cli.js", import.meta.url))
  if (existsSync(bundled)) return bundled
  return fileURLToPath(import.meta.resolve("@sourcefed/cli"))
}
