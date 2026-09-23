import type { MonitorEvent, MonitorEventSink, MonitorRecord } from "@sourcefed/core"

const GATE_TIMEOUT_MS = 3_000
const MAX_SUMMARY_CHARS = 500
const MAX_BODY_CHARS = 1_000

export type GateOptions = {
  url: string
  token?: string
  fetch?: typeof fetch
}

/** The JSON body POSTed for each event; the gate replies `{ "deliver": boolean }`. */
export type GatedEvent = {
  target: MonitorRecord["target"]
  monitorID: string
  source: MonitorRecord["source"]
  event: MonitorEvent
}

/** `SOURCEFED_GATE_URL` (and optional `SOURCEFED_GATE_TOKEN`), when set. */
export function gateFromEnv(): GateOptions | undefined {
  const url = process.env.SOURCEFED_GATE_URL

  if (!url) return undefined

  return { url, ...(process.env.SOURCEFED_GATE_TOKEN ? { token: process.env.SOURCEFED_GATE_TOKEN } : {}) }
}

/**
 * Asks another local consumer whether each event should reach the session.
 * Only an explicit `{ "deliver": false }` withholds it; a failed, slow, or
 * unclear answer delivers, so the gate can never lose an event.
 */
export class GatedEventSink implements MonitorEventSink {
  constructor(
    private readonly inner: MonitorEventSink,
    private readonly options: GateOptions,
  ) {}

  async deliver(input: { monitor: MonitorRecord; event: MonitorEvent }): Promise<{ ok: boolean; error?: string }> {
    if (await this.withheld(input)) return { ok: true }

    return this.inner.deliver(input)
  }

  private async withheld(input: { monitor: MonitorRecord; event: MonitorEvent }): Promise<boolean> {
    const body: GatedEvent = {
      target: input.monitor.target,
      monitorID: input.monitor.id,
      source: input.monitor.source,
      event: {
        ...input.event,
        summary: input.event.summary.slice(0, MAX_SUMMARY_CHARS),
        ...(input.event.body === undefined ? {} : { body: input.event.body.slice(0, MAX_BODY_CHARS) }),
      },
    }

    try {
      const response = await (this.options.fetch ?? fetch)(this.options.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.options.token ? { authorization: `Bearer ${this.options.token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(GATE_TIMEOUT_MS),
      })
      const reply: unknown = response.ok ? await response.json() : undefined

      return typeof reply === "object" && reply !== null && (reply as { deliver?: unknown }).deliver === false
    } catch (error) {
      console.warn(`[sourcefed] event gate unavailable, delivering: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }
}
