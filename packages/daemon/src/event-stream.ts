import type { QueuedMonitorEvent } from "@sourcefed/core"
import { parseDaemonFrame } from "./types/protocol.ts"
import { withTimeout } from "./utils"

/** Owns one SSE connection, its setup, serialized delivery and reconnect loop. */
export class DaemonEventStream {
  private readonly controller = new AbortController()
  private readonly subscribed = Promise.withResolvers<void>()
  private stream: AbortController | undefined
  private delivering = Promise.resolve()
  private closing: Promise<void> | undefined
  private ready = false
  private failedDelivery = false

  constructor(
    private readonly url: string,
    private readonly headers: Record<string, string>,
    private readonly onEvents: (events: QueuedMonitorEvent[]) => Promise<void>,
    private readonly acknowledge: (events: QueuedMonitorEvent[], signal: AbortSignal) => Promise<void>,
    private readonly onClose: () => void,
  ) {}

  async start(signal?: AbortSignal): Promise<void> {
    const abort = () => { void this.close() }
    signal?.addEventListener("abort", abort, { once: true })
    // Observe rejection before starting work: an already-aborted caller fails immediately.
    const setup = withTimeout(this.subscribed.promise, 15_000, `sourcefed event stream did not subscribe at ${this.url}`)
    if (signal?.aborted) abort()
    const running = this.run()
    void running.finally(() => signal?.removeEventListener("abort", abort))
    try {
      await setup
    } catch (error) {
      await this.close()
      throw error
    }
  }

  close(): Promise<void> {
    if (!this.closing) {
      this.subscribed.reject(new Error("sourcefed event stream closed"))
      // Pending setup has no delivery to drain and must release its fetch immediately.
      if (!this.ready) this.controller.abort()
      this.closing = this.drain()
    }
    return this.closing
  }

  private async drain(): Promise<void> {
    try {
      // Keep the daemon's claim until an admitted callback and its ack finish.
      await withTimeout(this.delivering, 15_000, "sourcefed event delivery did not drain")
    } catch (error) {
      console.error(`[sourcefed] closing event stream: ${String(error)}`)
    } finally {
      this.controller.abort()
      this.stream?.abort()
      this.onClose()
    }
  }

  private async run(): Promise<void> {
    let consecutiveFailures = 0
    while (!this.controller.signal.aborted) {
      this.failedDelivery = false
      try {
        await this.read()
        consecutiveFailures = 0
      } catch (error) {
        if (!this.controller.signal.aborted && !this.failedDelivery && ++consecutiveFailures === 1) {
          console.error(`[sourcefed] event stream ended: ${String(error)}`)
        }
      }
      // Reopening before ack finishes can replay the same event into the callback.
      await this.waitForDelivery()
      if (!this.controller.signal.aborted) await pause(500, this.controller.signal)
    }
  }

  private async read(): Promise<void> {
    const controller = new AbortController()
    const abort = () => controller.abort()
    this.stream = controller
    this.controller.signal.addEventListener("abort", abort, { once: true })
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      this.controller.signal.throwIfAborted()
      const response = await fetch(this.url, { signal: controller.signal, headers: this.headers })
      if (!response.ok || !response.body) {
        await response.body?.cancel()
        throw new Error(`event stream failed: ${response.status}`)
      }
      reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read()
        if (done) return
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split("\n\n")
        buffer = frames.pop() ?? ""
        for (const chunk of frames) await this.frame(chunk)
      }
    } finally {
      await reader?.cancel().catch(() => undefined)
      reader?.releaseLock()
      this.controller.signal.removeEventListener("abort", abort)
      if (this.stream === controller) this.stream = undefined
    }
  }

  private async frame(chunk: string): Promise<void> {
    if (this.closing || this.controller.signal.aborted) return
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data: ")) continue
      const frame = parseDaemonFrame(line.slice(6))
      if (!frame || !("type" in frame)) continue
      if (frame.type === "subscribed") {
        this.ready = true
        this.subscribed.resolve()
      }
      if (frame.type === "event" && frame.events.length > 0) {
        this.deliver(frame.events)
        // Apply backpressure rather than accumulating an unbounded delivery chain.
        await this.waitForDelivery()
      }
    }
  }

  private deliver(events: QueuedMonitorEvent[]): void {
    this.delivering = this.delivering.then(async () => {
      // Later batches from a failed connection must be released, not acknowledged.
      if (this.failedDelivery || this.controller.signal.aborted) return
      try {
        await this.onEvents(events)
        await this.acknowledge(events, this.controller.signal)
      } catch (error) {
        if (!this.controller.signal.aborted) console.error(`[sourcefed] event delivery failed: ${String(error)}`)
        this.failedDelivery = true
        this.stream?.abort()
      }
    })
  }

  private async waitForDelivery(): Promise<void> {
    if (this.controller.signal.aborted) return
    const stopped = Promise.withResolvers<void>()
    const abort = () => stopped.resolve()
    this.controller.signal.addEventListener("abort", abort, { once: true })
    try {
      await Promise.race([this.delivering, stopped.promise])
    } finally {
      this.controller.signal.removeEventListener("abort", abort)
    }
  }
}

export function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve() }
    const timer = setTimeout(finish, ms)
    signal.addEventListener("abort", finish, { once: true })
    if (signal.aborted) finish()
  })
}
