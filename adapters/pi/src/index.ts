import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent"
import { fileURLToPath } from "node:url"
import { Type } from "typebox"
import type { QueuedMonitorEvent } from "@sourcefed/core"
import type { LogEntryView, MonitorView } from "@sourcefed/daemon"
import { connectDaemonClient, daemonCommand, daemonEnvironment, spawnLocalDaemon, type DaemonClient } from "@sourcefed/daemon"
import { logLines, monitorLines, showSourcefedDialog } from "./dialog.ts"

const STATUS_REFRESH_MS = 3_000

const SOURCE_ICONS: Record<string, string> = {
  jira: "󰌃",
  github: "󰊤",
  slack: "󰒱",
}

type PiTarget = { kind: "pi-session"; id: string }

export default async function sourcefedExtension(pi: ExtensionAPI): Promise<void> {
  const listeners = new Map<string, { close(): Promise<void> }>()
  let client: DaemonClient | undefined
  let lastAttemptAt = 0
  let lastError: string | undefined
  let statusTimer: ReturnType<typeof setInterval> | undefined
  let statusCtx: ExtensionContext | undefined

  pi.on("session_start", async (_event, ctx) => {
    statusCtx = ctx
    await ensureTarget(ctx)
    void refreshStatus()
    statusTimer = setInterval(() => void refreshStatus(), STATUS_REFRESH_MS)
  })

  pi.on("session_shutdown", async () => {
    if (statusTimer) clearInterval(statusTimer)
    statusTimer = undefined
    statusCtx = undefined
    for (const listener of listeners.values()) await listener.close()
    listeners.clear()
    await client?.close()
    client = undefined
  })

  pi.registerTool({
    name: "sourcefed_monitor_create",
    label: "Sourcefed monitor create",
    description: "Create or reuse a Sourcefed monitor for the current Pi session.",
    parameters: Type.Object({
      name: Type.String(),
      sourceType: Type.Unsafe<string>({ type: "string", enum: ["jira", "github", "slack"] }),
      issueKey: Type.Optional(Type.String()),
      repo: Type.Optional(Type.String()),
      prNumber: Type.Optional(Type.Number()),
      channelId: Type.Optional(Type.String()),
      threadTs: Type.Optional(Type.String()),
      threadUrl: Type.Optional(Type.String()),
      pollIntervalSec: Type.Optional(Type.Number()),
    }),
    execute: async (_toolCallID, input, _signal, _onUpdate, ctx) => toolResult(await call(ctx, "monitor_create", input)),
  })

  pi.registerTool({
    name: "sourcefed_monitor_list",
    label: "Sourcefed monitor list",
    description: "List Sourcefed monitors for the current Pi session.",
    parameters: Type.Object({}),
    execute: async (_toolCallID, _input, _signal, _onUpdate, ctx) => toolResult(await call(ctx, "monitor_list", {})),
  })

  pi.registerTool({
    name: "sourcefed_monitor_status",
    label: "Sourcefed monitor status",
    description: "Read one Sourcefed monitor for the current Pi session.",
    parameters: Type.Object({ id: Type.String() }),
    execute: async (_toolCallID, input, _signal, _onUpdate, ctx) => toolResult(await call(ctx, "monitor_status", input)),
  })

  pi.registerTool({
    name: "sourcefed_monitor_stop",
    label: "Sourcefed monitor stop",
    description: "Stop one Sourcefed monitor for the current Pi session.",
    parameters: Type.Object({ id: Type.String() }),
    execute: async (_toolCallID, input, _signal, _onUpdate, ctx) => toolResult(await call(ctx, "monitor_stop", input)),
  })

  pi.registerTool({
    name: "sourcefed_monitor_start",
    label: "Sourcefed monitor start",
    description: "Start (re-enable) a stopped Sourcefed monitor for the current Pi session.",
    parameters: Type.Object({ id: Type.String() }),
    execute: async (_toolCallID, input, _signal, _onUpdate, ctx) => toolResult(await call(ctx, "monitor_start", input)),
  })

  pi.registerCommand("sourcefed", {
    description: "List Sourcefed monitors for the current Pi session",
    handler: async (_args, ctx) => {
      const result = (await call(ctx, "monitor_list", {})) as { monitors?: MonitorView[] }
      const monitors = Array.isArray(result?.monitors) ? result.monitors : []
      await ctx.ui.custom((tui, theme, _keybindings, done) =>
        showSourcefedDialog(tui, theme, done, `Sourcefed monitors (${monitors.length})`, monitorLines(monitors, theme)),
      )
    },
  })

  pi.registerCommand("sourcefed logs", {
    description: "Show recent Sourcefed notifications for the current Pi session",
    handler: async (_args, ctx) => {
      const result = (await call(ctx, "monitor_logs", {})) as { logs?: LogEntryView[] }
      const logs = Array.isArray(result?.logs) ? result.logs : []
      await ctx.ui.custom((tui, theme, _keybindings, done) =>
        showSourcefedDialog(tui, theme, done, `Sourcefed notifications (${logs.length})`, logLines(logs, theme)),
      )
    },
  })

  async function refreshStatus(): Promise<void> {
    const ctx = statusCtx
    if (!ctx) return
    const result = (await call(ctx, "monitor_list", {})) as { monitors?: unknown[] }
    const monitors = Array.isArray(result?.monitors) ? result.monitors : []
    if (monitors.length === 0) {
      ctx.ui.setStatus("sourcefed", undefined)
      return
    }
    const icons = monitors.map((monitor) => {
      const record = monitor as Record<string, unknown>
      const source = (record.source ?? {}) as Record<string, unknown>
      const icon = SOURCE_ICONS[String(source.type ?? "")] ?? "?"
      return ctx.ui.theme.fg(record.enabled ? "success" : "error", icon)
    })
    const line = monitors.length > 1 ? `${icons.join(" ")} (${monitors.length})` : icons.join(" ")
    ctx.ui.setStatus("sourcefed", line)
  }

  async function call(ctx: ExtensionContext, name: string, args: Record<string, unknown>): Promise<unknown> {
    const target = await ensureTarget(ctx)
    if (!client) return { ok: false, error: `sourcefed daemon unavailable: ${lastError ?? "not started"}` }
    return client.request(name.replace(/_/g, "."), { ...args, target })
  }

  async function ensureTarget(ctx: ExtensionContext): Promise<PiTarget | undefined> {
    await ensureClient()
    const target = { kind: "pi-session" as const, id: ctx.sessionManager.getSessionId() }
    if (client && !listeners.has(target.id)) {
      const listener = await client.subscribe(target, async (events) => {
        await routeEvents(pi, events, target, client!)
      })
      listeners.set(target.id, listener)
    }
    return target
  }

  async function ensureClient(): Promise<void> {
    if (client) return
    if (Date.now() - lastAttemptAt < 15_000) return
    lastAttemptAt = Date.now()
    try {
      const url = process.env.SOURCEFED_DAEMON_URL
      if (url) {
        client = await connectDaemonClient({ name: "sourcefed-pi", url })
      } else {
        const local = daemonCommand(cliEntry())
        const spawned = await spawnLocalDaemon({
          command: local.command,
          args: local.args,
          env: daemonEnvironment(),
        })
        client = await connectDaemonClient({ name: "sourcefed-pi", url: spawned.url })
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      console.error(`[sourcefed] daemon unavailable: ${lastError}`)
    }
  }
}

async function routeEvents(pi: ExtensionAPI, events: QueuedMonitorEvent[], target: PiTarget, daemon: DaemonClient): Promise<void> {
  const delivered: QueuedMonitorEvent[] = []
  for (const queued of events) {
    await pi.sendMessage({
      customType: "sourcefed-monitor",
      content: `[sourcefed monitor] ${queued.event.summary}${queued.event.body ? `\n\n${queued.event.body}` : ""}`,
      display: true,
      details: { actionable: queued.event.actionable, eventID: queued.id },
    }, { triggerTurn: queued.event.actionable, deliverAs: "steer" })
    delivered.push(queued)
  }
  if (delivered.length > 0) {
    await daemon.request("monitor.ack", {
      target,
      eventIDs: delivered.map((queued) => queued.id),
    })
  }
}

function cliEntry(): string {
  return fileURLToPath(import.meta.resolve("@sourcefed/cli"))
}

function toolResult(result: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result) }],
    details: {},
  }
}
