import type { MonitorEvent } from "./monitor-event.ts"

/** A poll that read its source: new events and the cursor to keep. */
export type SourcePollRead = {
  cursor: unknown
  events: MonitorEvent[]
  terminal: boolean
}

/**
 * A poll the source held back without reading, for example while its API's rate limit
 * waits. Nothing changes: the monitor keeps its cursor and stays due, so a later tick
 * polls it again from the same place.
 */
export type SourcePollDeferred = { deferred: true }

export type SourcePollResult = SourcePollRead | SourcePollDeferred
