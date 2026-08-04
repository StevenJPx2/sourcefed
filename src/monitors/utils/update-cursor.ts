import type { MonitorRecord } from "../types"
import { updateCursorValue } from "./update-cursor-value.ts"

export async function updateCursor(monitor: MonitorRecord, key: string, cursor: unknown): Promise<void> {
  await updateCursorValue(monitor, key, () => cursor)
}
