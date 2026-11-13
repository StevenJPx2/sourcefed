declare const __SOURCEFED_VERSION__: string

/**
 * The version of the RPC methods and event frames a program relies on:
 * `monitor.list`, `monitor.create`, `monitor.ack`, `daemon.health` and `GET /events`.
 * Bumped by one on any breaking change to them; additions keep it.
 */
export const DAEMON_PROTOCOL = 1

export type DaemonHealth = { ok: true; version: string; protocol: number }

/** What `daemon.health` answers: that the daemon is up, its sourcefed version, and its protocol. */
export function daemonHealth(): DaemonHealth {
  return { ok: true, version: __SOURCEFED_VERSION__, protocol: DAEMON_PROTOCOL }
}
