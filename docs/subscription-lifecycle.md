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
seconds before destroying its streaming socket. RPC requests also have a 15-second timeout.
Response readers, abort listeners and retry timers are released on termination.
Failed plugin registration closes the acquired bridge, including the public
plugin's guidance-hook setup path.

This does not add an exactly-once transaction between OpenCode admission and daemon
acknowledgement. As before, a host failure after admission but before acknowledgement
can replay an event; forced drain timeout leaves unacknowledged work for retry,
rather than dropping it. No monitor state, wire format or daemon endpoint changes.

## HTTP transport isolation

Demand-based ownership prevents duplicate streams but is not a process-wide fetch
budget: 256 legitimately owned sessions can still consume Bun’s default 256
concurrent fetch slots. Returning response headers does not release a slot while
the SSE body remains open. This can starve unrelated provider requests, token
refresh and web fetches even when every subscription has a valid owner. Socket
counts alone cannot distinguish this condition from a subscription leak.

`event-transport.ts` opens SSE with `node:http` / `node:https`, using one dedicated,
non-pooled socket per subscription (`agent: false`). RPC remains short-lived
`fetch`. The existing event-stream state machine still owns setup deadlines,
backpressure, callback/ack serialization, reconnect and draining cancellation.
The adapter bounds its Web Stream queue by bytes (64 KiB high-water mark), destroys
failed HTTP responses immediately, and destroys every response when its reader
terminates. HTTPS uses normal certificate/hostname verification and configured
CA trust; it does not disable TLS checks. The daemon URL must address its HTTP(S)
endpoint directly: unlike `fetch`, this transport does not follow redirects.

This changes no daemon endpoint, monitor state, event claim or acknowledgement
contract and does not change `BUN_CONFIG_MAX_HTTP_REQUESTS`. It removes long-lived
requests from that budget, not the need for sockets; one socket per demanded
session remains, and OS resource limits still apply.

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

The fetch-budget regression runs the built daemon client in a separate Bun
process with a 256-fetch limit. It opens 300 subscriptions, proves an unrelated
HTTP fetch and an event acknowledgement complete, and checks all streaming
sockets close. Before the transport change, a 256-stream version of this test
failed because the unrelated fetch timed out after 1.5 seconds; after the change
it passes. The test requires `bun` on PATH (or `SOURCEFED_TEST_BUN`); without Bun
it explicitly skips this runtime-specific test. The TLS rejection test requires
`openssl` and confirms a self-signed untrusted certificate is rejected.

For the installed OpenCode runtime, run:

```sh
npm run build:public
node scripts/check-opencode-subscriptions.mjs
```

This provider-free probe requires `opencode` and `openssl`. It starts only a private
foreground host with fresh HOME, all XDG directories and explicit `OPENCODE_DB`,
loads the built public daemon client in a test plugin, and creates no sessions or
monitors. It checks 300 subscriptions each over HTTP and trusted HTTPS, unrelated
fetch responsiveness, delivery/ack, setup cancellation and zero remaining sockets.
Only the child trusts its generated test CA; its files and servers are cleaned up.
On OpenCode 2.2.7 the plugin reported embedded Bun 1.4.4, revision
`38afee6c84fcf48c0edb2466aa4b27d287a59c30`; unrelated HTTP and HTTPS fetches
completed in under 2 ms with 300 streams open. The 14 existing client/lifecycle
checks also passed under `bun test --timeout 25000`, including reconnect, callback
retry, acknowledgement retry and forced drain. This is runtime evidence, not an
assumption that an external Bun binary matches OpenCode. The probe uses built
workspace artifacts and does not replace the installed-tarball release gate.

After reviewing the change, follow `docs/e2e-release-plan.md` to release/install the
updated package. Reload the OpenCode plugins or restart OpenCode at a user-chosen
time so old bridge instances close and the new client code loads. Updating files
alone does not remove streams held by an already-running old plugin. A SourceFed
daemon restart and stopping monitors are not required. After one refresh interval,
verify stream counts track enabled session targets, not loaded project instances.

## Contracts consulted

- [Bun fetch concurrency](https://bun.sh/docs/runtime/networking/fetch): 256
  simultaneous requests by default; additional requests queue until one ends.
- [Node stream adapters](https://nodejs.org/api/stream.html#streamreadabletowebstreamreadable-options):
  bounded byte-based queuing and cancellation through the response reader.
- [OpenCode V2 plugins](https://opencode.ai/docs/build/plugins): setup cleanup,
  context location, globally accessible sessions, synthetic delivery and tools.
- [OpenCode V2 RPC](https://opencode.ai/v2/docs/build/plugins/rpc): the unchanged
  Chauffeur gate's JSON Schema values are `unknown` at the TypeScript boundary.
- `packages/daemon/src/daemon.ts`: enabled target enumeration, event claims,
  acknowledgements and monitor-stop purging.
