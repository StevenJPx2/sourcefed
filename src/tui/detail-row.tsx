/** @jsxImportSource @opentui/solid */

import type { DetailRowProps } from "./types"

export function DetailRow(props: DetailRowProps) {
  return (
    <box flexDirection="row" width="100%">
      <text fg={props.theme.textMuted}>{props.label}: </text>
      <text fg={props.theme.text}>{props.value}</text>
    </box>
  )
}
