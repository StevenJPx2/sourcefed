import * as v from "valibot"
import { MonitorSourceSchema } from "../sources/schema.ts"

export const MonitorRecordSchema = v.object({
  id: v.string(),
  name: v.string(),
  source: MonitorSourceSchema,
  delivery: v.picklist(["poll", "webhook"]),
  sessionID: v.string(),
  pollIntervalSec: v.number(),
  enabled: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
  cursors: v.record(v.string(), v.unknown()),
})

export const MonitorRegistrySchema = v.object({
  monitors: v.array(MonitorRecordSchema),
})
