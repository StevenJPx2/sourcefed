import * as v from "valibot"
import { SlackReadResultSchema } from "../../schema.ts"
import type { SlackReadResult } from "../../types"

export function parseSlackCliResult(raw: string): SlackReadResult {
  try {
    const result = v.safeParse(SlackReadResultSchema, JSON.parse(raw))
    if (result.success) return result.output
  } catch {
    // Normalize malformed CLI output to the same authentication/format error.
  }
  throw new Error("slackcli returned invalid JSON; run `slackcli auth list` to verify authentication")
}
