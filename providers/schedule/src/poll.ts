import * as v from "valibot"
import { PollMonitor, toMonitorEvent, type SourceEvent } from "@sourcefed/core"
import { firedEvent, missedEvent } from "./events.ts"
import { firingsBetween, systemTimezone, zonedIso } from "./firings.ts"
import { ScheduleCursorSchema, type ScheduleCursor, type ScheduleSource } from "./schema.ts"

/** A single time found within this long of it is on time; anything later was missed. */
export const ON_TIME_MS = 2 * 60_000

/**
 * One poll: the scheduled times since the last check. The first poll only marks
 * the time. One time found promptly is `schedule.fired`; anything else, such as
 * the times that came while the daemon was stopped, is one `schedule.missed`.
 */
export function pollSchedule(source: ScheduleSource, cursorRaw: unknown, now: Date = new Date()): { cursor: ScheduleCursor; events: SourceEvent[] } {
  const cursor = { checkedAt: now.toISOString() }
  const parsed = v.safeParse(ScheduleCursorSchema, cursorRaw)
  if (!parsed.success) return { cursor, events: [] }

  const timezone = source.timezone ?? systemTimezone()
  const firings = firingsBetween(source.cron, timezone, new Date(parsed.output.checkedAt), now)
  if (!firings) return { cursor, events: [] }

  const at = zonedIso(firings.latest, timezone)
  const onTime = firings.count === 1 && now.getTime() - firings.latest.getTime() <= ON_TIME_MS
  const event = onTime ? firedEvent(source, at, timezone) : missedEvent(source, at, timezone, firings.count)
  return { cursor, events: [event] }
}

export const schedulePollMonitor = new PollMonitor<ScheduleSource>({
  run: async (source, cursor) => {
    const result = pollSchedule(source, cursor)
    return {
      cursor: result.cursor,
      events: result.events.map((event) => toMonitorEvent(event, source)),
      terminal: false,
    }
  },
})
