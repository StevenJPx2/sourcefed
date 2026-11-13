import * as v from "valibot"

export const ScheduleSourceSchema = v.object({
  type: v.literal("schedule"),
  cron: v.string(),
  job: v.string(),
  timezone: v.optional(v.string()),
})

export type ScheduleSource = v.InferOutput<typeof ScheduleSourceSchema>

/** The instant up to which scheduled times have been considered. */
export const ScheduleCursorSchema = v.object({
  checkedAt: v.string(),
})

export type ScheduleCursor = v.InferOutput<typeof ScheduleCursorSchema>
