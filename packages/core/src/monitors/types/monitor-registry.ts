import type * as v from "valibot"
import type { MonitorRegistrySchema } from "../schema.ts"

export type MonitorRegistry = v.InferOutput<typeof MonitorRegistrySchema>
