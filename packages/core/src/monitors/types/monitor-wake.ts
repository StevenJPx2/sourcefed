/**
 * A poll-only source that a webhook can wake early: a verified delivery on `path`
 * that `matches` a monitor's source makes its next tick poll. The poll stays the
 * source of truth.
 */
export type MonitorWake<TSource> = {
  path: string
  matches: (source: TSource, payload: unknown, eventName: string) => boolean
}
