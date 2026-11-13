import type { SourceInputSchema } from "@sourcefed/core"
import { SOURCE_MAP } from "./registry.ts"
import type { DaemonCreateInput } from "./types"

/** What an agent passes to `monitor_create`: one source, tagged by its `type`. */
export type MonitorCreateToolInput = {
  name: string
  source: { type: string } & Record<string, unknown>
  pollIntervalSec?: number
}

/**
 * The JSON Schema of `monitor_create`, shared by the OpenCode, Pi and MCP tools.
 * `source` is a union of every provider's input, so a model sees only the fields
 * of the source it picks.
 */
export function monitorCreateToolSchema(): Record<string, unknown> {
  const sources = Object.entries(SOURCE_MAP).map(([type, monitor]) => sourceBranch(type, monitor.input))
  return {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, description: "Human-readable monitor name, e.g. 'PROJ-12345', 'PR #42'" },
      source: { anyOf: sources, description: "What to watch: one source, chosen by its type" },
      pollIntervalSec: { type: "number", minimum: 15, description: "Polling interval in seconds (min 15, default 60)" },
    },
    required: ["name", "source"],
    additionalProperties: false,
  }
}

/** The daemon's flat create input for a tool's `{ name, source, pollIntervalSec }`. */
export function toDaemonCreateInput(input: unknown): DaemonCreateInput {
  const candidate = (input ?? {}) as Partial<MonitorCreateToolInput>
  const source = candidate.source
  if (!source || typeof source !== "object" || typeof source.type !== "string") {
    throw new Error("monitor_create requires source: { type, … }")
  }

  const { type, ...fields } = source
  const flat: Record<string, unknown> = { ...fields, name: candidate.name, sourceType: type }
  if (candidate.pollIntervalSec !== undefined) flat.pollIntervalSec = candidate.pollIntervalSec
  return flat as DaemonCreateInput
}

function sourceBranch(type: string, input: SourceInputSchema): Record<string, unknown> {
  return {
    type: "object",
    description: input.description,
    properties: { type: { type: "string", enum: [type] }, ...input.properties },
    required: ["type", ...input.required],
    additionalProperties: false,
  }
}
