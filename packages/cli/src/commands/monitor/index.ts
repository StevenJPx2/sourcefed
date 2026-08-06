import os from "node:os"
import type { DaemonClient } from "@sourcefed/daemon"
import { connectDaemonClient, defaultDaemonUrl } from "@sourcefed/daemon"
import { flag } from "../../utils/flags.ts"
import { ack } from "./ack.ts"
import { create } from "./create.ts"
import { events } from "./events.ts"
import { follow } from "./follow.ts"
import { list } from "./list.ts"
import { logs } from "./logs.ts"
import { remove } from "./remove.ts"
import { sources } from "./sources.ts"
import { start } from "./start.ts"
import { status } from "./status.ts"
import { stop } from "./stop.ts"

const SUBCOMMANDS: Record<string, (context: MonitorContext) => Promise<void>> = {
  list,
  logs,
  sources,
  status,
  stop,
  start,
  remove,
  events,
  follow,
  ack,
  create,
}

const SUBCOMMAND_NAMES = Object.keys(SUBCOMMANDS).join(", ")

export async function runMonitor(argv: string[]): Promise<void> {
  const [subcommand, ...args] = argv
  const target = {
    kind: flag(args, "target-kind") ?? "cli",
    id: flag(args, "target-id") ?? process.env.SOURCEFED_TARGET_ID ?? os.hostname(),
  }
  const client = await connectDaemonClient({
    name: "sourcefed-cli",
    url: process.env.SOURCEFED_DAEMON_URL ?? defaultDaemonUrl(),
  })
  const run = subcommand ? SUBCOMMANDS[subcommand] : undefined
  if (!run) {
    await client.close()
    throw new Error(`monitor expects ${SUBCOMMAND_NAMES}`)
  }
  try {
    await run({ client, target, args })
  } finally {
    await client.close()
  }
}

export type MonitorContext = {
  client: DaemonClient
  target: { kind: string; id: string }
  args: string[]
}
