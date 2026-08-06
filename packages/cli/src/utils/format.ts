import type { LogEntryView, MonitorView } from "@sourcefed/daemon"

export function printMonitors(monitors: MonitorView[]): void {
  if (monitors.length === 0) {
    console.log(dim("no monitors for this target"))
    return
  }
  for (const monitor of monitors) {
    const status = monitor.enabled ? green("enabled") : red("stopped")
    const delivery = dim(monitor.delivery)
    console.log(`${monitor.icon} ${monitor.describe}  ${status}  ${delivery}`)
  }
}

export function printLogs(logs: LogEntryView[]): void {
  if (logs.length === 0) {
    console.log(dim("no notifications sent yet"))
    return
  }
  for (const entry of logs) {
    const time = dim(new Date(entry.at).toLocaleString())
    const marker = entry.actionable ? yellow("▶") : dim("·")
    console.log(`${marker} ${entry.icon} ${time} ${entry.describe}`)
    console.log(`    ${entry.summary}`)
    if (entry.body) console.log(dim(`    ${entry.body}`))
  }
}

export function printResult(result: unknown): void {
  console.log(JSON.stringify(result, null, 2))
}

export function green(text: string): string {
  return `\x1b[32m${text}\x1b[0m`
}

export function red(text: string): string {
  return `\x1b[31m${text}\x1b[0m`
}

export function yellow(text: string): string {
  return `\x1b[33m${text}\x1b[0m`
}

export function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`
}
