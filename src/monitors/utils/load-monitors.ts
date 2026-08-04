import { readFile } from "node:fs/promises"
import * as v from "valibot"
import { MonitorRegistrySchema } from "../schema.ts"
import type { MonitorRegistry } from "../types"
import { emptyRegistry } from "./empty-registry.ts"
import { STATE_FILE } from "./paths.ts"

export async function loadMonitors(): Promise<MonitorRegistry> {
  try {
    const raw: unknown = JSON.parse(await readFile(STATE_FILE, "utf8"))
    const result = v.safeParse(MonitorRegistrySchema, raw)
    if (result.success) return result.output
    return emptyRegistry()
  } catch {
    return emptyRegistry()
  }
}
