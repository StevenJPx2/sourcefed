import type { MonitorSource } from "#sourcefed/sources"
import type { PollRunner } from "./poll-runner.ts"

export type PollMonitorOptions<TSource extends MonitorSource> = {
  run: PollRunner<TSource>
}
