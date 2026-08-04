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
      this.tick().catch((error) => console.error("[sourcefed] monitor tick error:", error))
    }, this.pollLoopSec * 1000)
    await this.tick()
  }

  async tick(): Promise<void> {
    await tick(this.context)
  }

  async webhook(request: Request): Promise<Response> {
    return handleWebhook(request, this.context)
  }

  stop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = undefined
  }
}
