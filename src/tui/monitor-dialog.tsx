/** @jsxImportSource @opentui/solid */

import { createMemo, onMount, Show } from "solid-js"
import type { MonitorDialogProps } from "./types"
import { useMonitors } from "./utils"
import { MonitorCard } from "./monitor-card"

export function MonitorDialog(props: MonitorDialogProps) {
  const { monitors } = useMonitors(props.sessionID)
  const theme = createMemo(() => props.api.theme.current)
  const active = createMemo(() => monitors().filter((monitor) => monitor.enabled))
  let scrollbox: { focus: () => void } | undefined
  const dialogHeight = Math.max(12, props.api.renderer.height - Math.floor(props.api.renderer.height / 4) - 2)

  onMount(() => {
    setTimeout(() => scrollbox?.focus(), 1)
  })

  return (
    <box flexDirection="column" width="100%" height={dialogHeight} padding={2} backgroundColor={theme().backgroundPanel} border borderColor={theme().borderSubtle} overflow="hidden" zIndex={100}>
      <box flexDirection="row" justifyContent="space-between" width="100%">
        <text fg={theme().accent}><b>Sourcefed monitors</b></text>
        <text fg={theme().textMuted}>{active().length} active · Esc close</text>
      </box>
      <text fg={theme().textMuted}>Active monitors created by this session</text>
      <scrollbox
        ref={(value) => {
          scrollbox = value
        }}
        flexGrow={1}
        flexShrink={1}
        minHeight={0}
        width="100%"
        scrollY
        focusable
        focused
        marginTop={1}
        backgroundColor={theme().backgroundPanel}
        overflow="hidden"
      >
        <Show when={active().length > 0} fallback={<text fg={theme().textMuted}>No monitors for this session</text>}>
          {active().map((monitor) => <MonitorCard monitor={monitor} theme={theme()} />)}
        </Show>
      </scrollbox>
    </box>
  )
}
