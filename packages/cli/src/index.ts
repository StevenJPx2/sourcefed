#!/usr/bin/env node

import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { runDaemon } from "./commands/daemon.ts"
import { runMcp } from "./commands/mcp.ts"
import { runMonitor } from "./commands/monitor/index.ts"
import { runSetup } from "./commands/setup.ts"
import { runSkillsCommand } from "./skills"

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  daemon: runDaemon,
  mcp: runMcp,
  monitor: runMonitor,
  skills: runSkillsCommand,
  setup: runSetup,
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const [command, ...args] = argv
  const run = command ? COMMANDS[command] : undefined
  if (!run) {
    printUsage()
    process.exitCode = 1
    return
  }
  await run(args)
}

function printUsage(): void {
  console.error("sourcefed daemon [--port PORT] [--host HOST]")
  console.error("sourcefed mcp --stdio|--http [--port PORT]")
  console.error("sourcefed monitor create|list|status|stop|start|remove|events|follow|ack|logs|sources [options]")
  console.error("sourcefed skills [list|get <name>|path [name]]")
  console.error("sourcefed setup [opencode|pi]")
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
