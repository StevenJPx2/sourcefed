import type * as v from "valibot"
import type { MonitorSource } from "#sourcefed/sources"

export type MonitorSchema<TSource extends MonitorSource> = v.BaseSchema<unknown, TSource, v.BaseIssue<unknown>>

export type MonitorOptions<TSource extends MonitorSource> = {
  type: TSource["type"]
  schema: MonitorSchema<TSource>
}
