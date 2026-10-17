import type { QueuedMonitorEvent } from "@sourcefed/core"
import type { DaemonClient } from "@sourcefed/daemon"

export type SessionLocation = { directory: string; project: { id: string } }
type SessionInfo = { projectID: string; location: { directory: string } }
export interface SubscriptionOwner {
  readonly location: SessionLocation
  getSession(sessionID: string, signal: AbortSignal): Promise<SessionInfo>
  routeEvents(events: QueuedMonitorEvent[]): Promise<void>
}
type Subscription = {
  info: SessionInfo
  controller: AbortController
  listener: Promise<{ close(): Promise<void> }>
}

const REFRESH_MS = 15_000

/** One client, timer and stream per enabled session, shared by all plugin locations. */
export class OpenCodeSubscriptions {
  private readonly owners = new Set<SubscriptionOwner>()
  private readonly subscriptions = new Map<string, Subscription>()
  private readonly lifetime = new AbortController()
  private daemon: DaemonClient | undefined
  private connecting: Promise<DaemonClient | undefined> | undefined
  private refreshing: Promise<void> | undefined
  private dirty = false
  private lastAttemptAt = -Infinity
  private timer: ReturnType<typeof setInterval> | undefined

  constructor(private readonly connect: () => Promise<DaemonClient>) {}

  get closed(): boolean { return this.lifetime.signal.aborted }

  async add(owner: SubscriptionOwner): Promise<void> {
    if (this.closed) throw new Error("sourcefed subscription hub is closed")
    this.owners.add(owner)
    if (!this.timer) {
      this.timer = setInterval(() => void this.refresh(), REFRESH_MS)
      this.timer.unref?.()
    }
    await this.refresh()
  }

  async remove(owner: SubscriptionOwner): Promise<void> {
    this.owners.delete(owner)
    const closing: Promise<void>[] = []
    for (const [id, subscription] of this.subscriptions) {
      if (this.ownerFor(subscription.info)) continue
      this.subscriptions.delete(id)
      closing.push(this.closeSubscription(subscription))
    }
    if (this.owners.size > 0) {
      await Promise.all(closing)
      await this.refresh()
      return
    }
    this.lifetime.abort()
    clearInterval(this.timer)
    this.timer = undefined
    await Promise.all(closing)
    await this.daemon?.close()
    this.daemon = undefined
    await this.connecting
    await this.refreshing
  }

  async request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const daemon = await this.ensureDaemon()
    if (!daemon || this.closed) throw new Error("sourcefed daemon unavailable or bridge closed")
    return daemon.request(method, params)
  }

  refresh(): Promise<void> {
    if (this.closed) return Promise.resolve()
    this.dirty = true
    if (!this.refreshing) {
      this.refreshing = this.refreshLoop()
    }
    return this.refreshing
  }

  private async refreshLoop(): Promise<void> {
    try {
      do {
        this.dirty = false
        try {
          const daemon = await this.ensureDaemon()
          if (daemon && !this.closed) await this.reconcile(daemon)
        } catch (error) {
          if (!this.closed) console.error(`[sourcefed] refresh failed: ${String(error)}`)
        }
      } while (this.dirty && !this.closed)
    } finally {
      // Clear in the same turn as the final dirty check, before resolving callers.
      this.refreshing = undefined
    }
  }

  private async ensureDaemon(): Promise<DaemonClient | undefined> {
    if (this.closed) return undefined
    if (this.daemon) return this.daemon
    if (this.connecting) return this.connecting
    if (Date.now() - this.lastAttemptAt < REFRESH_MS) return undefined
    this.lastAttemptAt = Date.now()
    this.connecting = this.connect().then(async (daemon) => {
      if (this.closed) { await daemon.close(); return undefined }
      this.daemon = daemon
      return daemon
    }).catch((error: unknown) => {
      console.error(`[sourcefed] daemon unavailable: ${String(error)}`)
      return undefined
    }).finally(() => { this.connecting = undefined })
    return this.connecting
  }

  private async reconcile(daemon: DaemonClient): Promise<void> {
    const result = await daemon.request("monitor.targets", { kind: "opencode-session" })
    const targets = enabledSessions(result)
    for (const [id, subscription] of this.subscriptions) {
      if (targets.has(id)) continue
      this.subscriptions.delete(id)
      await this.closeSubscription(subscription)
    }
    // Serial setup bounds concurrent work independently of the number of locations.
    for (const id of targets) {
      if (this.closed) return
      const reader = this.owners.values().next().value
      if (!reader) return
      let info: SessionInfo | undefined
      try {
        info = await reader.getSession(id, this.lifetime.signal)
      } catch (error) {
        // A transport error is not evidence that a session was deleted.
        if (!error || typeof error !== "object" || !("_tag" in error) || error._tag !== "SessionNotFoundError") {
          if (!this.closed) console.error(`[sourcefed] session ${id} lookup failed: ${String(error)}`)
          continue
        }
      }
      if (this.closed) return
      const owner = info && this.ownerFor(info)
      const existing = this.subscriptions.get(id)
      if (!owner || !info) {
        if (existing) {
          this.subscriptions.delete(id)
          await this.closeSubscription(existing)
        }
      } else if (existing) {
        existing.info = info
      } else {
        await this.subscribe(daemon, id, info)
      }
    }
  }

  private ownerFor(info: SessionInfo): SubscriptionOwner | undefined {
    const candidates = [...this.owners].filter((owner) => owner.location.project.id === info.projectID)
    return candidates.find((owner) => owner.location.directory === info.location.directory) ?? candidates[0]
  }

  private async subscribe(daemon: DaemonClient, id: string, info: SessionInfo): Promise<void> {
    const controller = new AbortController()
    const subscription: Subscription = {
      info, controller,
      listener: daemon.subscribe({ kind: "opencode-session", id }, async (events) => {
        await this.route(id, subscription, events)
      }, { signal: controller.signal }),
    }
    this.subscriptions.set(id, subscription)
    try {
      await subscription.listener
    } catch (error) {
      if (this.subscriptions.get(id) === subscription) this.subscriptions.delete(id)
      if (!controller.signal.aborted) console.error(`[sourcefed] subscribe ${id} failed: ${String(error)}`)
    }
  }

  private async route(id: string, subscription: Subscription, events: QueuedMonitorEvent[]): Promise<void> {
    const reader = this.owners.values().next().value
    if (!reader) throw new Error("sourcefed session owner unloaded")
    // A session can move between refreshes. Resolve routing at delivery time too.
    const info = await reader.getSession(id, this.lifetime.signal)
    const owner = this.ownerFor(info)
    if (!owner) throw new Error("sourcefed session has no loaded project owner")
    subscription.info = info
    await owner.routeEvents(events)
  }

  private async closeSubscription(subscription: Subscription): Promise<void> {
    subscription.controller.abort()
    await subscription.listener.then((listener) => listener.close(), () => undefined)
  }
}

function enabledSessions(result: unknown): Set<string> {
  if (!result || typeof result !== "object" || !("targets" in result) || !Array.isArray(result.targets)) {
    throw new Error("invalid monitor.targets response")
  }
  const ids = new Set<string>()
  for (const target of result.targets) {
    if (!target || target.kind !== "opencode-session" || typeof target.id !== "string") {
      throw new Error("invalid opencode-session target")
    }
    ids.add(target.id)
  }
  return ids
}
