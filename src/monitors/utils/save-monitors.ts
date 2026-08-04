import { mkdir, writeFile } from "node:fs/promises"
import type { MonitorRegistry } from "../types"
import { STATE_DIR, STATE_FILE } from "./paths.ts"

export async function saveMonitors(registry: MonitorRegistry): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true })
  await writeFile(STATE_FILE, JSON.stringify(registry, null, 2))
}
