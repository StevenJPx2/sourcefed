import type { MonitorSource } from "#sourcefed/sources"
import type { SourcePollResult } from "#sourcefed/types"

/** Polls one monitor's source; `monitorId` names the monitor, for sources that share a budget. */
export type PollRunner<TSource extends MonitorSource> = (source: TSource, cursor: unknown, monitorId: string) => Promise<SourcePollResult>
