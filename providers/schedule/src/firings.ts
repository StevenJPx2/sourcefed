import { Cron } from "croner"

/**
 * Counting stops here, and a longer run of missed times reports this many. Each
 * step is a croner search, so the bound keeps one poll to about 0.1 s.
 */
export const MISSED_COUNT_LIMIT = 1_000

export type Firings = { latest: Date; count: number }

/** Refuse an invalid cron or unknown zone, with croner's message. croner checks a zone only when it computes a time. */
export function checkSchedule(cron: string, timezone: string): void {
  scheduleCron(cron, timezone).nextRun()
}

// croner's types stay out of these signatures: the public declarations would need croner installed.
function scheduleCron(cron: string, timezone: string): Cron {
  return new Cron(cron, { timezone, paused: true })
}

/** The Mac's own zone, for a schedule created without one. */
export function systemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** The scheduled times of `pattern` in (after, until], or undefined when there are none. */
export function firingsBetween(pattern: string, timezone: string, after: Date, until: Date): Firings | undefined {
  const cron = scheduleCron(pattern, timezone)
  let next = cron.nextRun(after)
  let latest: Date | undefined
  let count = 0
  while (next && next.getTime() <= until.getTime() && count < MISSED_COUNT_LIMIT) {
    latest = next
    count += 1
    next = cron.nextRun(next)
  }
  if (!latest) return undefined

  // Past the counting limit, the latest time is found from the end of the window.
  if (count === MISSED_COUNT_LIMIT) {
    const end = new Date(Math.floor(until.getTime() / 1000) * 1000 + 1000)
    latest = cron.previousRuns(1, end)[0] ?? latest
  }
  return { latest, count }
}

/** An ISO 8601 time with the zone's offset, such as `2026-11-14T02:00:00+05:30`. */
export function zonedIso(date: Date, timeZone: string): string {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "longOffset",
  })
  const parts = Object.fromEntries(format.formatToParts(date).map((part) => [part.type, part.value]))
  const offset = parts.timeZoneName === "GMT" ? "+00:00" : parts.timeZoneName.slice(3)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`
}
