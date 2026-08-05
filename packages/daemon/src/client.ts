import type { MonitorTarget, QueuedMonitorEvent } from "@sourcefed/core"
import type { DaemonClient, DaemonClientOptions } from "./types"
import { parseDaemonFrame } from "./types/protocol.ts"
import { RequestRouter, defaultDaemonUrl, encodeTarget, sleep, targetKey, withTimeout } from "./utils"

export async function connectDaemonClient(options: DaemonClientOptions): Promise<DaemonClient> {
  const url = options.url ?? process.env.SOURCEFED_DAEMON_URL ?? defaultDaemonUrl()
  return new HttpDaemonClient(url, options.token ?? process.env.SOURCEFED_DAEMON_TOKEN)
}

class HttpDaemonClient implements DaemonClient {
  private readonly baseURL: string
  private readonly token?: string
  private readonly router = new RequestRouter()
  private readonly listeners = new Map<string, Set<(events: QueuedMonitorEvent[]) => Promise<void>>>()
  private readonly streams = new Set<AbortController>()

  constructor(baseURL: string, token?: string) {
    this.baseURL = baseURL.replace(/\/+$/, "")
    this.token = token
  }

  private headers(): Record<string, string> {
    return this.token ? { authorization: `Bearer ${this.token}` } : {}
  }

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = this.router.nextID()
    const promise = this.router.register(id)
    try {
      const response = await fetch(`${this.baseURL}/rpc`, {
        method: "POST",
        headers: { "content-type": "application/json", ...this.headers() },
        body: JSON.stringify({ id, method, params }),
      })
      const frame = await response.json() as { id?: number; result?: unknown; error?: string }
      if (!response.ok || frame.error) throw new Error(frame.error ?? `daemon request failed: ${response.status}`)
      this.router.settle(id, { result: frame.result })
    } catch (error) {
      this.router.settle(id, { error: error instanceof Error ? error.message : String(error) })
    }
    return promise
  }

  async subscribe(target: MonitorTarget, onEvents: (events: QueuedMonitorEvent[]) => Promise<void>): Promise<{ close(): Promise<void> }> {
    const key = targetKey(target)
    let callbacks = this.listeners.get(key)
    if (!callbacks) {
      callbacks = new Set()
      this.listeners.set(key, callbacks)
    }
    callbacks.add(onEvents)
    const controller = new AbortController()
    this.streams.add(controller)
    const url = `${this.baseURL}/events?target=${encodeTarget(target)}`

    let markSubscribed!: () => void
    const subscribed = new Promise<void>((resolve) => {
      markSubscribed = () => resolve()
    })
    let drainComplete = false
    let draining = false
    let redrainRequested = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let markDrained!: () => void
    const drained = new Promise<void>((resolve) => {
      markDrained = resolve
    })
    let buffered: QueuedMonitorEvent[][] = []
    let delivering: Promise<void> = Promise.resolve()

    const deliver = (events: QueuedMonitorEvent[]): Promise<void> => {
      if (!callbacks?.has(onEvents) || events.length === 0) return Promise.resolve()
      delivering = delivering.then(() => deliverWithRetry(events, 0)).catch((error) => {
        console.error(`[sourcefed] event delivery failed: ${error instanceof Error ? error.message : String(error)}`)
      })
      return delivering
    }

    const deliverWithRetry = async (events: QueuedMonitorEvent[], attempt: number): Promise<void> => {
      try {
        await onEvents(events)
      } catch (error) {
        if (attempt >= 2) {
          console.error(`[sourcefed] event delivery failed after retries; re-draining queue: ${error instanceof Error ? error.message : String(error)}`)
          redrainRequested = true
          void performDrain()
          return
        }
        await sleep(250 * (attempt + 1))
        await deliverWithRetry(events, attempt + 1)
      }
    }

    const performDrain = async (): Promise<void> => {
      if (draining) {
        redrainRequested = true
        return
      }
      draining = true
      try {
        let passes = 0
        do {
          redrainRequested = false
          passes += 1
          try {
            const drainResult = (await this.request("monitor.events", { target })) as { events?: QueuedMonitorEvent[] }
            drainComplete = true
            const drainedIds = new Set((drainResult.events ?? []).map((event) => event.id))
            if (drainResult.events && drainResult.events.length > 0) await deliver(drainResult.events)
            for (const batch of buffered) {
              const fresh = batch.filter((event) => !drainedIds.has(event.id))
              if (fresh.length > 0) await deliver(fresh)
            }
            buffered = []
            markDrained()
          } catch (error) {
            console.error(`[sourcefed] event drain failed: ${error instanceof Error ? error.message : String(error)}`)
            redrainRequested = true
          }
        } while (redrainRequested && passes < 3)
        // The drain is a catch-up nicety, not the subscription: if every attempt
        // fails (e.g. transient network error or a daemon restart), still resolve
        // so the live stream stays established — unacked events persist in the
        // daemon queue and are picked up by the next reconnect/redrain.
        if (redrainRequested) markDrained()
      } finally {
        draining = false
      }
    }

    const runStream = async (): Promise<void> => {
      try {
        const response = await fetch(url, { signal: controller.signal, headers: this.headers() })
        if (!response.ok || !response.body) throw new Error(`event stream failed: ${response.status}`)
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const frames = buffer.split("\n\n")
          buffer = frames.pop() ?? ""
          for (const chunk of frames) {
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue
              const frame = parseDaemonFrame(line.slice(6))
              if (!frame || !("type" in frame)) continue
              if (frame.type === "subscribed") {
                markSubscribed()
                drainComplete = false
                void performDrain()
              }
              if (frame.type === "event") {
                if (drainComplete) void deliver(frame.events)
                else buffered.push(frame.events)
              }
            }
          }
        }
        consecutiveFailures = 0
      } catch (error) {
        if (!controller.signal.aborted) {
          consecutiveFailures += 1
          // Log only the first failure of a burst; the reconnect loop is expected
          // to recover, and logging every 500ms retry floods host UIs.
          if (consecutiveFailures === 1) {
            console.error(`[sourcefed] event stream ended: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      }
    }

    let consecutiveFailures = 0

    void (async () => {
      while (!controller.signal.aborted && callbacks?.has(onEvents)) {
        await runStream()
        if (controller.signal.aborted) break
        await sleep(500)
      }
    })()

    try {
      await withTimeout(subscribed, 15_000, `sourcefed event stream did not subscribe at ${url}`)
      await withTimeout(drained, 15_000, "sourcefed initial event drain timed out")
    } catch (error) {
      if (retryTimer) clearTimeout(retryTimer)
      const callbacks = this.listeners.get(key)
      callbacks?.delete(onEvents)
      if (callbacks && callbacks.size === 0) this.listeners.delete(key)
      controller.abort()
      this.streams.delete(controller)
      throw error
    }

    return {
      close: async () => {
        if (retryTimer) clearTimeout(retryTimer)
        const callbacks = this.listeners.get(key)
        callbacks?.delete(onEvents)
        if (callbacks && callbacks.size === 0) this.listeners.delete(key)
        controller.abort()
        this.streams.delete(controller)
      },
    }
  }

  async close(): Promise<void> {
    for (const controller of this.streams) controller.abort()
    this.streams.clear()
    this.router.rejectAll(new Error("daemon closed"))
    this.listeners.clear()
  }
}
