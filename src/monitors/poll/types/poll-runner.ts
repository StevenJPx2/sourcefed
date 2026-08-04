import type { MonitorSource } from "#sourcefed/sources"
import type { SourcePollResult } from "#sourcefed/types"

export type PollRunner<TSource extends MonitorSource> = (source: TSource, cursor: unknown) => Promise<SourcePollResult>
