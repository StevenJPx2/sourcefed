import type { Theme } from "@earendil-works/pi-coding-agent"
import type { Component, TUI } from "@earendil-works/pi-tui"
import { Container, Spacer, Text, truncateToWidth } from "@earendil-works/pi-tui"
import { DynamicBorder } from "@earendil-works/pi-coding-agent"
import type { LogEntryView } from "@sourcefed/daemon"

type Line = { text: string }

export function showSourcefedDialog(
  _tui: TUI,
  theme: Theme,
  done: (result: null) => void,
  title: string,
  lines: Line[],
): Component & { handleInput(data: string): void } {
  const container = new Container()

  container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)))
  container.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0))
  container.addChild(new Spacer(1))
  for (const line of lines) {
    container.addChild(new Text(line.text, 1, 0))
  }
  container.addChild(new Spacer(1))
  container.addChild(new Text(theme.fg("dim", "esc to close"), 1, 0))
  container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)))

  return {
    render: (width) => {
      const rendered = container.render(width)
      return rendered.map((line) => truncateToWidth(line, width))
    },
    invalidate: () => container.invalidate(),
    handleInput: (data) => {
      if (data === "\u001b" || data === "\r") done(null)
    },
  }
}

export function logLines(logs: LogEntryView[], theme: Theme): Line[] {
  if (logs.length === 0) return [{ text: theme.fg("dim", "No notifications sent yet") }]
  return logs.flatMap((entry) => {
    const time = new Date(entry.at).toLocaleString()
    const marker = entry.actionable ? theme.fg("warning", "▶") : theme.fg("dim", "·")
    const summary = theme.fg("text", entry.summary)
    const lines = [{ text: `${marker} ${entry.icon} ${theme.fg("muted", time)} ${summary}` }]
    if (entry.body) lines.push({ text: theme.fg("muted", `  ${entry.body}`) })
    return lines
  })
}
