/** @jsxImportSource @opentui/solid */

import { Show } from "solid-js"
import { sourceDefinition } from "#sourcefed/source-utils"
import type { MonitorCardProps } from "./types"
import { DetailRow } from "./detail-row"
import { formatTimestamp, monitorDetail, monitorTone, monitorUnresponsive, sourceCursor, sourceLabel } from "./utils"

export function MonitorCard(props: MonitorCardProps) {
  const cursor = sourceCursor(props.monitor)
  const definition = sourceDefinition(props.monitor.source)
  const unresponsive = monitorUnresponsive(props.monitor)
  let status = "healthy"
  let statusTone = props.theme.success
  if (!props.monitor.enabled) {
    status = "stopped"
    statusTone = props.theme.textMuted
  } else if (unresponsive) {
    status = "recovering connection"
    statusTone = props.theme.error
  }
  const cursorSummary = definition.cursorSummary(cursor)
  let webhookPreference: string | undefined
  if (definition.webhook) {
    webhookPreference = "not preferred"
    if (definition.webhook.preferred) webhookPreference = "preferred, polling fallback"
  }

  return (
    <box flexDirection="column" width="100%" marginBottom={1}>
      <box flexDirection="row" width="100%">
        <text fg={monitorTone(props.monitor, props.theme)}>{definition.icon}</text>
        <text fg={props.theme.text}> {sourceLabel(props.monitor)}</text>
        <text fg={props.theme.textMuted}>{monitorDetail(props.monitor)}</text>
        <text fg={statusTone}> [{status}]</text>
      </box>
      <DetailRow theme={props.theme} label="Name" value={props.monitor.name} />
      <DetailRow theme={props.theme} label="Source" value={definition.describe(props.monitor.source)} />
      <DetailRow theme={props.theme} label="Delivery" value={props.monitor.delivery} />
      <Show when={webhookPreference}>
        <DetailRow theme={props.theme} label="Webhook preference" value={webhookPreference ?? ""} />
      </Show>
      <DetailRow theme={props.theme} label="Poll interval" value={`${props.monitor.pollIntervalSec}s`} />
      <DetailRow theme={props.theme} label="Created" value={formatTimestamp(props.monitor.createdAt)} />
      <DetailRow theme={props.theme} label="Updated" value={formatTimestamp(props.monitor.updatedAt)} />
      <DetailRow theme={props.theme} label="Last poll" value={formatTimestamp(props.monitor.cursors.__lastPolledAt)} />
      <DetailRow theme={props.theme} label="Webhook heartbeat" value={formatTimestamp(props.monitor.cursors.__webhookHeartbeatAt)} />
      <DetailRow theme={props.theme} label="Session" value={props.monitor.sessionID} />
      <DetailRow theme={props.theme} label="Cursor" value={cursorSummary} />
    </box>
  )
}
