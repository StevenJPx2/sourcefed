import type { SourceEvent } from "@sourcefed/core"
import type { ScheduleSource } from "./schema.ts"

export function firedEvent(source: ScheduleSource, at: string, timezone: string): SourceEvent {
  return {
    kind: "schedule.fired",
    id: `schedule.fired:${source.job}:${at}`,
    at,
    summary: `Schedule ${source.job} fired for ${at}`,
    actionable: true,
    subject: { type: "schedule", key: source.job, job: source.job, at, cron: source.cron, timezone },
  }
}

export function missedEvent(source: ScheduleSource, at: string, timezone: string, missed: number): SourceEvent {
  const times = missed === 1 ? "1 time" : `${missed.toLocaleString("en")} times`
  return {
    kind: "schedule.missed",
    id: `schedule.missed:${source.job}:${at}`,
    at,
    summary: `Schedule ${source.job} missed ${times}; the latest was ${at}`,
    body: "Sourcefed was not running, or the Mac was asleep, when these times came. This one event stands for all of them.",
    actionable: true,
    subject: { type: "schedule", key: source.job, job: source.job, at, cron: source.cron, timezone, missed },
  }
}
