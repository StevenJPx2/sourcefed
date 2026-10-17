# OpenCode subscription lifecycle

## Ownership and demand

`adapters/opencode/subscriptions.ts` owns one daemon client and one 15-second timer.
`bridge.ts` stores the hub under a versioned process-global symbol so plugin instances
and re-evaluated copies of the module share it. Loaded bridges are its owners; the
last unload closes the hub, and a later plugin load creates a fresh one.

Demand comes only from `monitor.targets` (enabled monitors). A session must still
exist and its `projectID` must match a loaded owner's `ctx.location.project.id`.
Prefer an owner whose directory matches the session's current location; otherwise
use a surviving owner in the same project. Session access alone is not ownership:
OpenCode V2 session APIs can cross locations. Worktrees and session moves are
reconciled using the session's current metadata.
Delivery also resolves that metadata immediately before routing, so a move does
not have to wait for the next refresh to select the right owner.

There is one stream per demanded, owned session, not per monitor or plugin. A
surviving owner takes over routing without replacing the stream. Tools capture their
own bridge instead of consulting a global last-loaded bridge.

Startup, successful tool mutations, and the timer reconcile both additions and
removals. List/status calls do not create subscriptions. Externally created,
re-enabled, stopped or removed monitors converge within one refresh interval when
the daemon and OpenCode are reachable. Transient inventory/session lookup failures
preserve existing streams; an explicit `SessionNotFoundError` releases a deleted
session's stream. Refreshes and connection attempts are coalesced; session setup is
serial, so concurrent setup work does not grow with the number of plugin instances.

## Delivery and cleanup

The existing Chauffeur gate and synthetic-message metadata/resume behavior are
unchanged. The daemon still owns event claims and acknowledgement. The HTTP client
serializes delivery with backpressure, retries failed callbacks by reconnecting,
and retries acknowledgements without invoking a successful callback again. A
reconnect waits for the in-flight delivery/acknowledgement before reopening.

Subscription cancellation covers pending setup as well as established streams.
Setup times out after 15 seconds; reconnect waits are cancellable. Closing an
established stream drains admitted delivery and acknowledgement for up to 15
seconds before aborting its fetch. RPC requests also have a 15-second timeout.
Response readers, abort listeners and retry timers are released on termination.
Failed plugin registration closes the acquired bridge, including the public
plugin's guidance-hook setup path.

This does not add an exactly-once transaction between OpenCode admission and daemon
acknowledgement. As before, a host failure after admission but before acknowledgement
can replay an event; forced drain timeout leaves unacknowledged work for retry,
rather than dropping it. No monitor state, wire format or daemon endpoint changes.

## Proof and rollout

`npm run check` includes bridge lifecycle tests and live HTTP contract tests.
The HTTP regression loads 40 plugin instances for 20 enabled session targets,
checks that peak active streams remain 20 across repeated list calls, delivers and
acknowledges one event once, stops a monitor, and unloads every owner back to zero.
Other tests cover setup cancellation, failed connection/setup recovery, session
moves/deletion, refresh/unload races, callback retry and reconnect during ack.

A manual isolated OpenCode 2.0.32 probe also loaded the built plugin through an
auto-discovered local shim in two locations, discovered two externally created
monitors, admitted one synthetic event into the real session inbox and acknowledged
it, then returned from two streams to zero after stopping the test monitors. It
used fresh HOME/XDG directories, a private foreground host, an in-memory test daemon
and no provider credentials. This does not replace the installed-tarball release gate.

After reviewing the change, follow `docs/e2e-release-plan.md` to release/install the
updated package. Reload the OpenCode plugins or restart OpenCode at a user-chosen
time so old bridge instances close and the new client code loads. Updating files
alone does not remove streams held by an already-running old plugin. A SourceFed
daemon restart and stopping monitors are not required. After one refresh interval,
verify stream counts track enabled session targets, not loaded project instances.

## Contracts consulted

- [OpenCode V2 plugins](https://opencode.ai/v2/docs/build/plugins): setup cleanup,
  context location, globally accessible sessions, synthetic delivery and tools.
- [OpenCode V2 RPC](https://opencode.ai/v2/docs/build/plugins/rpc): the unchanged
  Chauffeur gate's JSON Schema values are `unknown` at the TypeScript boundary.
- `packages/daemon/src/daemon.ts`: enabled target enumeration, event claims,
  acknowledgements and monitor-stop purging.
