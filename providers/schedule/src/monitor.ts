import { Monitor, type MonitorCreateInput, type SourceInput } from "@sourcefed/core"
import { scheduleCron, systemTimezone } from "./firings.ts"
import { schedulePollMonitor } from "./poll.ts"
import { ScheduleSourceSchema, type ScheduleSource } from "./schema.ts"

export class ScheduleMonitor extends Monitor<ScheduleSource> {
  readonly poll = schedulePollMonitor
  readonly defaultPollIntervalSec = 15

  constructor() {
    super({ type: "schedule", schema: ScheduleSourceSchema })
  }

  readonly key = (source: ScheduleSource): string => `schedule:${source.job}:${source.cron}:${source.timezone ?? ""}`
  readonly input = {
    description: "A cron schedule: schedule.fired at each time, or one schedule.missed for times that came while sourcefed was stopped",
    properties: {
      cron: { type: "string", minLength: 1, description: "A cron expression, e.g. '0 2 * * *' for 02:00 every day" },
      job: { type: "string", minLength: 1, description: "The job's name, carried by every event's subject" },
      timezone: { type: "string", description: "An IANA time zone, e.g. 'Asia/Kolkata'; the Mac's own when left out" },
    },
    required: ["cron", "job"],
  }
  readonly icon = "󰃰"
  readonly label = (source: ScheduleSource): string => source.job
  readonly detail = (source: ScheduleSource): string => ` ${source.cron}${source.timezone ? ` ${source.timezone}` : ""}`
  readonly describe = (source: ScheduleSource): string => `Schedule ${source.job} (${source.cron})`

  build(input: MonitorCreateInput): SourceInput {
    const cron = input.cron?.trim()
    const job = input.job?.trim()
    if (!cron) return { error: "cron is required for a schedule monitor" }
    if (!job) return { error: "job is required for a schedule monitor" }

    try {
      scheduleCron(cron, input.timezone ?? systemTimezone()).nextRun()
    } catch (error) {
      return { error: `invalid schedule: ${error instanceof Error ? error.message : String(error)}` }
    }

    const source: ScheduleSource = { type: "schedule", cron, job }
    if (input.timezone) source.timezone = input.timezone
    return source
  }
}
