import type { MonitorEventQueue, MonitorEventSink, MonitorRecord, MonitorTarget } from "@sourcefed/core"

export class NotifyingEventSink implements MonitorEventSink {
  constructor(
    private readonly queue: MonitorEventQueue,
    private readonly notify: (target: MonitorTarget) => void,
  ) {}

  async deliver(input: { monitor: MonitorRecord; event: import("@sourcefed/core").MonitorEvent }): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.queue.enqueue(input)
      this.notify(input.monitor.target)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}
