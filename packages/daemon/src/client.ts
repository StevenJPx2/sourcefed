import type { MonitorTarget, QueuedMonitorEvent } from "@sourcefed/core"
import type { DaemonClient, DaemonClientOptions } from "./types"
import { DaemonEventStream, pause } from "./event-stream.ts"
import { defaultDaemonUrl, encodeTarget } from "./utils"

export async function connectDaemonClient(options: DaemonClientOptions): Promise<DaemonClient> {
  const url = options.url ?? process.env.SOURCEFED_DAEMON_URL ?? defaultDaemonUrl()
  return new HttpDaemonClient(url, options.token ?? process.env.SOURCEFED_DAEMON_TOKEN)
}

class HttpDaemonClient implements DaemonClient {
  private readonly baseURL: string
  private readonly streams = new Set<DaemonEventStream>()
  private readonly lifetime = new AbortController()
  private cursor = 0
  private closing: Promise<void> | undefined

  constructor(baseURL: string, private readonly token?: string) {
    this.baseURL = baseURL.replace(/\/+$/, "")
  }

  private headers(): Record<string, string> {
    return this.token ? { authorization: `Bearer ${this.token}` } : {}
  }

  async request(method: string, params?: Record<string, unknown>, signal = this.lifetime.signal): Promise<unknown> {
    if (this.closing && signal === this.lifetime.signal) throw new Error("daemon closed")
    signal.throwIfAborted()
    const response = await fetch(`${this.baseURL}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json", ...this.headers() },
      body: JSON.stringify({ id: ++this.cursor, method, params }),
      signal: AbortSignal.any([signal, this.lifetime.signal, AbortSignal.timeout(15_000)]),
    })
    const frame = await response.json() as { result?: unknown; error?: string }
    if (!response.ok || frame.error) throw new Error(frame.error ?? `daemon request failed: ${response.status}`)
    return frame.result
  }

  async subscribe(target: MonitorTarget, onEvents: (events: QueuedMonitorEvent[]) => Promise<void>, options?: { signal?: AbortSignal }): Promise<{ close(): Promise<void> }> {
    if (this.closing) throw new Error("daemon closed")
    this.lifetime.signal.throwIfAborted()
    const stream = new DaemonEventStream(
      `${this.baseURL}/events?target=${encodeTarget(target)}`, this.headers(), onEvents,
      (events, signal) => this.acknowledge(target, events, signal),
      () => this.streams.delete(stream),
    )
    this.streams.add(stream)
    try {
      await stream.start(options?.signal)
      return { close: () => stream.close() }
    } catch (error) {
      await stream.close()
      throw error
    }
  }

  private async acknowledge(target: MonitorTarget, events: QueuedMonitorEvent[], signal: AbortSignal): Promise<void> {
    let attempt = 0
    while (!signal.aborted) {
      try {
        await this.request("monitor.ack", { target, eventIDs: events.map((event) => event.id) }, signal)
        return
      } catch (error) {
        if (++attempt === 3) {
          console.error(`[sourcefed] event acknowledgement still failing; retrying without repeating delivery: ${String(error)}`)
        }
        await pause(Math.min(250 * 2 ** Math.min(attempt - 1, 4), 4_000), signal)
      }
    }
  }

  close(): Promise<void> {
    this.closing ??= Promise.all([...this.streams].map((stream) => stream.close())).then(() => {
      this.lifetime.abort()
      this.streams.clear()
    })
    return this.closing
  }
}
