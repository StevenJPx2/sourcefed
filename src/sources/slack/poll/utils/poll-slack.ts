import { parseSlackCliResult } from "./parse-slack-cli-result.ts"
import { parseSlackReadResult } from "./parse-slack-read-result.ts"
import { runSlackCli } from "./run-slack-cli.ts"
import type { SlackCursor, SlackEvent, SlackSourceRecord } from "../../types"

export async function pollSlack(source: SlackSourceRecord, cursorRaw: unknown): Promise<{ events: SlackEvent[]; cursor: SlackCursor; terminal: false }> {
  const raw = await runSlackCli([
    "conversations",
    "read",
    source.channelId,
    "--thread-ts",
    source.threadTs,
    "--limit",
    "100",
    "--json",
  ])
  const result = parseSlackCliResult(raw)
  const parsed = parseSlackReadResult(result, cursorRaw)
  return { ...parsed, terminal: false }
}
