import type * as v from "valibot"
import type { MonitorRecordSchema } from "../schema.ts"

export type MonitorRecord = v.InferOutput<typeof MonitorRecordSchema>
