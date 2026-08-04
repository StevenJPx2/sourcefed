/** @jsxImportSource @opentui/solid */

import { createMemo, createSignal, onCleanup, Show } from "solid-js"
import { monitorDetail, monitorIcon, monitorTone, sourceLabel } from "./utils"
import type { MonitorRowsProps } from "./types"

export function MonitorRows(props: MonitorRowsProps) {
  const [spinnerFrame, setSpinnerFrame] = createSignal(0)
  const visible = createMemo(() => {
    const active = props.monitors().filter((monitor) => monitor.enabled)
    if (props.compact) return active.slice(0, 4)
    return active
  })
  const timer = setInterval(() => setSpinnerFrame((frame) => frame + 1), 120)
  onCleanup(() => clearInterval(timer))

  return (
    <box flexDirection="column" width="100%">
      <Show when={visible().length > 0} fallback={<text fg={props.theme.textMuted}>No active monitors</text>}>
        {visible().map((monitor) => (
          <box flexDirection="row" width="100%">
            <text fg={monitorTone(monitor, props.theme)}>{monitorIcon(monitor, spinnerFrame())}</text>
            <text fg={props.theme.text}> {sourceLabel(monitor)}</text>
            <text fg={props.theme.textMuted}>{monitorDetail(monitor)}</text>
          </box>
        ))}
      </Show>
      <Show when={props.compact && visible().length < props.monitors().filter((monitor) => monitor.enabled).length}>
        <text fg={props.theme.textMuted}>Open Sourcefed for more</text>
      </Show>
    </box>
  )
}
