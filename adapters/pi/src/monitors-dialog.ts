import type { Theme } from "@earendil-works/pi-coding-agent"
import type { Component, Keybinding, KeybindingsManager } from "@earendil-works/pi-tui"
import { truncateToWidth } from "@earendil-works/pi-tui"
import type { MonitorView } from "@sourcefed/daemon"

export type MonitorAction = "stop" | "start" | "remove"

/** Runs one action on a monitor and answers the target's monitors afterwards. */
export type RunMonitorAction = (action: MonitorAction, id: string) => Promise<MonitorView[]>

export type MonitorManagerDeps = {
  theme: Pick<Theme, "fg" | "bold">
  keys: Pick<KeybindingsManager, "matches">
  run: RunMonitorAction
  requestRender: () => void
  close: () => void
}

type Mode =
  | { kind: "browse" }
  | { kind: "confirm-remove"; monitor: MonitorView }
  | { kind: "busy"; label: string }

const PROGRESS: Record<MonitorAction, string> = { stop: "Stopping", start: "Starting", remove: "Deleting" }

// The /sourcefed dialog: every monitor of the session, with the same stop, start and
// delete the agent's tools have. Delete asks first; it cannot be undone.
export class MonitorManager implements Component {
  private monitors: MonitorView[]
  private selected = 0
  private mode: Mode = { kind: "browse" }
  private error: string | undefined

  constructor(monitors: MonitorView[], private readonly deps: MonitorManagerDeps) {
    this.monitors = monitors
  }

  handleInput(data: string): void {
    switch (this.mode.kind) {
      case "busy":
        return
      case "confirm-remove":
        return this.handleConfirm(data, this.mode.monitor)
      case "browse":
        return this.handleBrowse(data)
    }
  }

  render(width: number): string[] {
    const { theme } = this.deps
    const active = this.monitors.filter((monitor) => monitor.enabled).length
    const border = theme.fg("accent", "─".repeat(Math.max(0, width)))
    const lines = [
      border,
      ` ${theme.fg("accent", theme.bold(`Sourcefed monitors (${active} active)`))}`,
      "",
      ...this.listLines(),
      "",
      ...this.statusLines(),
      border,
    ]
    return lines.map((line) => truncateToWidth(line, width))
  }

  invalidate(): void {}

  private handleBrowse(data: string): void {
    if (this.matches(data, "tui.select.cancel") || this.matches(data, "tui.select.confirm")) return this.deps.close()
    if (this.matches(data, "tui.select.up")) return this.select(this.selected - 1)
    if (this.matches(data, "tui.select.down")) return this.select(this.selected + 1)
    const monitor = this.monitors[this.selected]
    if (!monitor) return
    if (data === "s") void this.perform(monitor.enabled ? "stop" : "start", monitor)
    if (data === "d") this.setMode({ kind: "confirm-remove", monitor })
  }

  private handleConfirm(data: string, monitor: MonitorView): void {
    if (data === "y") void this.perform("remove", monitor)
    else if (data === "n" || this.matches(data, "tui.select.cancel")) this.setMode({ kind: "browse" })
  }

  private async perform(action: MonitorAction, monitor: MonitorView): Promise<void> {
    this.error = undefined
    this.setMode({ kind: "busy", label: `${PROGRESS[action]} ${monitor.name}…` })
    try {
      this.monitors = await this.deps.run(action, monitor.id)
      const kept = this.monitors.findIndex((candidate) => candidate.id === monitor.id)
      this.selected = clamp(kept >= 0 ? kept : this.selected, this.monitors.length)
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
    }
    this.setMode({ kind: "browse" })
  }

  private select(index: number): void {
    this.selected = clamp(index, this.monitors.length)
    this.deps.requestRender()
  }

  private setMode(mode: Mode): void {
    this.mode = mode
    this.deps.requestRender()
  }

  private matches(data: string, keybinding: Keybinding): boolean {
    return this.deps.keys.matches(data, keybinding)
  }

  private listLines(): string[] {
    const { theme } = this.deps
    if (this.monitors.length === 0) return [` ${theme.fg("dim", "No monitors")}`]
    return this.monitors.flatMap((monitor, index) => {
      const selected = index === this.selected
      const marker = selected ? theme.fg("accent", "›") : " "
      const header = ` ${marker} ${statusDot(monitor, theme)} ${monitor.icon} ${theme.fg("text", monitor.describe)} [${statusLabel(monitor)}]`
      return selected ? [header, ...detailLines(monitor, theme)] : [header]
    })
  }

  private statusLines(): string[] {
    const { theme } = this.deps
    const lines: string[] = []
    if (this.error) lines.push(` ${theme.fg("error", this.error)}`)
    switch (this.mode.kind) {
      case "busy":
        lines.push(` ${theme.fg("muted", this.mode.label)}`)
        break
      case "confirm-remove":
        lines.push(` ${theme.fg("warning", `Delete ${this.mode.monitor.name}? It stops watching and its record is removed. y/n`)}`)
        break
      case "browse":
        lines.push(` ${theme.fg("dim", "↑↓ select · s stop/start · d delete · esc close")}`)
    }
    return lines
  }
}

function clamp(index: number, length: number): number {
  return Math.min(Math.max(index, 0), Math.max(length - 1, 0))
}

function statusLabel(monitor: MonitorView): string {
  if (!monitor.enabled) return "stopped"
  return monitor.unresponsive ? "recovering connection" : "healthy"
}

function statusDot(monitor: MonitorView, theme: MonitorManagerDeps["theme"]): string {
  if (!monitor.enabled) return theme.fg("dim", "●")
  return theme.fg(monitor.unresponsive ? "error" : "success", "●")
}

function detailLines(monitor: MonitorView, theme: MonitorManagerDeps["theme"]): string[] {
  const rows: Array<[string, string]> = [
    ["Name", monitor.name],
    ["Delivery", monitor.delivery],
    ["Poll interval", `${monitor.pollIntervalSec}s`],
    ["Created", formatTime(monitor.createdAt)],
    ["Updated", formatTime(monitor.updatedAt)],
    ["Last poll", formatTime(monitor.lastPolledAt)],
    ["Webhook heartbeat", formatTime(monitor.webhookHeartbeatAt)],
  ]
  return rows.map(([label, value]) => theme.fg("muted", `     ${label}: ${value}`))
}

function formatTime(value: string | undefined): string {
  if (!value) return "never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
