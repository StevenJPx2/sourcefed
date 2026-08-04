#!/usr/bin/env bun

import os from "node:os"
import { serveStdio } from "@modelcontextprotocol/server/stdio"
import { connectSourcefedClient, createSourcefedMcp, createSourcefedStdio, parseToolResult, type SourcefedClientOptions } from "@sourcefed/mcp"

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const [command, subcommand, ...rest] = argv

  if (command === "mcp") {
    await runMcp([subcommand, ...rest].filter((value): value is string => value !== undefined))
    return
  }

  if (command === "monitor") {
    await runMonitor(subcommand, rest)
    return
  }

  printUsage()
  process.exitCode = 1
}

async function runMcp(args: string[]): Promise<void> {
  const mode = args[0] ?? "--stdio"
  if (mode === "--stdio") {
    const mcp = createSourcefedStdio()
    await mcp.runtime.start()
    const webhookServer = startWebhookServer(mcp)
    await serveStdio(mcp.factory)
    webhookServer?.stop()
    mcp.close()
    return
  }

  if (mode !== "--http") {
    throw new Error("mcp expects --stdio or --http")
  }

  const port = Number(flag(args, "port") ?? process.env.SOURCEFED_MCP_PORT ?? 8787)
  const hostname = flag(args, "host") ?? process.env.SOURCEFED_MCP_HOST ?? "127.0.0.1"
  const mcp = createSourcefedMcp()
  await mcp.runtime.start()
  const server = Bun.serve({
    hostname,
    port,
    fetch: (request) => new URL(request.url).pathname === "/mcp" ? mcp.handler.fetch(request) : mcp.runtime.webhook(request),
  })
  console.error(`[sourcefed] MCP server on http://${hostname}:${server.port}/mcp`)
  await new Promise<void>(() => {})
}

function startWebhookServer(mcp: ReturnType<typeof createSourcefedStdio>): ReturnType<typeof Bun.serve> | undefined {
  const enabled = Boolean(
    process.env.SOURCEFED_ENABLE_WEBHOOKS === "1" ||
    process.env.SOURCEFED_WEBHOOK_PORT ||
    process.env.SOURCEFED_GITHUB_WEBHOOK_SECRET ||
    process.env.SOURCEFED_SLACK_SIGNING_SECRET,
  )
  if (!enabled) return undefined

  try {
    return Bun.serve({
      hostname: process.env.SOURCEFED_WEBHOOK_HOST ?? "127.0.0.1",
      port: Number(process.env.SOURCEFED_WEBHOOK_PORT ?? 8788),
      fetch: (request) => mcp.runtime.webhook(request),
    })
  } catch (error) {
    console.error(`[sourcefed] webhook listener unavailable; continuing with MCP and polling: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

async function runMonitor(subcommand: string | undefined, args: string[]): Promise<void> {
  const target = {
    kind: flag(args, "target-kind") ?? "cli",
    id: flag(args, "target-id") ?? process.env.SOURCEFED_TARGET_ID ?? os.hostname(),
  }
  const clientOptions: SourcefedClientOptions = {
    name: "sourcefed-cli",
    url: process.env.SOURCEFED_MCP_URL ?? "http://127.0.0.1:8787/mcp",
  }
  const client = await connectSourcefedClient(clientOptions)
  try {
    if (subcommand === "list") {
      printResult(await client.callTool({ name: "monitor_list", arguments: { target } }))
      return
    }

    const id = flag(args, "id")
    if ((subcommand === "status" || subcommand === "stop") && !id) throw new Error(`${subcommand} requires --id`)
    if (subcommand === "status" || subcommand === "stop") {
      printResult(await client.callTool({ name: `monitor_${subcommand}`, arguments: { target, id } }))
      return
    }

    if (subcommand === "create") {
      const sourceType = flag(args, "source-type")
      if (sourceType !== "jira" && sourceType !== "github" && sourceType !== "slack") throw new Error("create requires --source-type jira|github|slack")
      const input: Record<string, unknown> = {
        name: flag(args, "name") ?? sourceType,
        sourceType,
        target,
      }
      const keyMap: Record<string, string> = {
        "issue-key": "issueKey",
        repo: "repo",
        "channel-id": "channelId",
        "thread-ts": "threadTs",
        "thread-url": "threadUrl",
      }
      for (const key of Object.keys(keyMap)) {
        const value = flag(args, key)
        if (value) input[keyMap[key]] = value
      }
      const prNumber = flag(args, "pr-number")
      if (prNumber) input.prNumber = Number(prNumber)
      printResult(await client.callTool({ name: "monitor_create", arguments: input }))
      return
    }
  } finally {
    await client.close()
  }

  throw new Error("monitor expects create, list, status, or stop")
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}

function printResult(result: unknown): void {
  console.log(JSON.stringify(parseToolResult(result), null, 2))
}

function printUsage(): void {
  console.error("sourcefed mcp --stdio|--http [--port PORT]")
  console.error("sourcefed monitor create|list|status|stop [options]")
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
