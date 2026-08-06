import { flag } from "../../utils/flags.ts"
import { printResult } from "../../utils/format.ts"
import type { MonitorContext } from "./index.ts"

export async function create(context: MonitorContext): Promise<void> {
  const sourceType = flag(context.args, "source-type")
  const sourceTypes = (await context.client.request("daemon.sourceTypes")) as { sourceTypes?: string[] }
  if (!sourceType || !sourceTypes.sourceTypes?.includes(sourceType)) {
    throw new Error(`create requires --source-type ${sourceTypes.sourceTypes?.join("|") ?? "unknown"}`)
  }
  const input: Record<string, unknown> = {
    name: flag(context.args, "name") ?? sourceType,
    sourceType,
    target: context.target,
  }
  const keyMap: Record<string, string> = {
    "issue-key": "issueKey",
    repo: "repo",
    "channel-id": "channelId",
    "thread-ts": "threadTs",
    "thread-url": "threadUrl",
  }
  for (const key of Object.keys(keyMap)) {
    const value = flag(context.args, key)
    if (value) input[keyMap[key]] = value
  }
  const prNumber = flag(context.args, "pr-number")
  if (prNumber) input.prNumber = Number(prNumber)
  const pollIntervalSec = flag(context.args, "poll-interval-sec")
  if (pollIntervalSec) input.pollIntervalSec = Number(pollIntervalSec)
  printResult(await context.client.request("monitor.create", input))
}
