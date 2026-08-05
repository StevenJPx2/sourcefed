import type { MonitorContext, MonitorEventSink, MonitorStore } from "./types"
import type { MonitorSourceRegistry } from "./sources"
import { MonitorService } from "./monitors/service.ts"
import { tick } from "./monitors/poll/utils/tick.ts"
import { handleWebhook } from "./monitors/webhook/utils/handle-webhook.ts"
import type { Monitor } from "./monitors"

export type MonitorRuntimeOptions = {
  store: MonitorStore
  sink: MonitorEventSink
  sources: MonitorSourceRegistry
  sourceForWebhookPath: (path: string) => Monitor | undefined
  pollLoopSec?: number
}

export class MonitorRuntime {
  readonly service: MonitorService
  readonly context: MonitorContext
  private timer?: ReturnType<typeof setInterval>
  private readonly activeTicks = new Set<Promise<void>>()

  constructor(options: MonitorRuntimeOptions) {
    this.service = new MonitorService(options.store)
    this.context = {
      service: this.service,
      sink: options.sink,
      sources: options.sources,
      sourceForWebhookPath: options.sourceForWebhookPath,
    }
    this.pollLoopSec = Math.max(1, options.pollLoopSec ?? 5)
  }

  private readonly pollLoopSec: number

  async start(): Promise<void> {
    await this.service.dedupe()
    if (this.timer) return
    this.timer = setInterval(() => {
      const tick = this.tick().catch((error) => console.error("[sourcefed] monitor tick error:", error))
      this.activeTicks.add(tick)
      void tick.finally(() => this.activeTicks.delete(tick))
    }, this.pollLoopSec * 1000)
    const initial = this.tick().catch((error) => console.error("[sourcefed] monitor tick error:", error))
    this.activeTicks.add(initial)
    void initial.finally(() => this.activeTicks.delete(initial))
  }

  async tick(): Promise<void> {
    await tick(this.context)
  }

  async webhook(request: Request): Promise<Response> {
    return handleWebhook(request, this.context)
  }

  async stop(): Promise<boolean> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
    const ticks = [...this.activeTicks]
    if (ticks.length === 0) return true
    let timer: ReturnType<typeof setTimeout> | undefined
    const settled = await Promise.race([
      Promise.allSettled(ticks).then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => {
          console.warn("[sourcefed] stop waited 30s for in-flight monitor ticks; retaining state lock")
          resolve(false)
        }, 30_000)
      }),
    ])
    if (timer) clearTimeout(timer)
    return settled
  }
}
