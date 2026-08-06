#!/usr/bin/env node

import os from "node:os"
import path from "node:path"
import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { serveStdio } from "@modelcontextprotocol/server/stdio"
import { connectDaemonClient, defaultDaemonUrl, handleDaemonHttpRequest, serveHttp, SourcefedDaemon, type DaemonClientOptions, type HttpServer, type LogEntryView, type MonitorView } from "@sourcefed/daemon"
import { createSourcefedMcp, createSourcefedStdio } from "@sourcefed/mcp"
import { runSkillsCommand } from "./skills"

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const [command, subcommand, ...rest] = argv

  if (command === "daemon") {
    await runDaemon([subcommand, ...rest].filter((value): value is string => value !== undefined))
    return
  }

  if (command === "mcp") {
    await runMcp([subcommand, ...rest].filter((value): value is string => value !== undefined))
    return
  }

  if (command === "monitor") {
    await runMonitor(subcommand, rest)
    return
  }

  if (command === "skills") {
    await runSkillsCommand([subcommand, ...rest].filter((value): value is string => value !== undefined))
    return
  }

  printUsage()
  process.exitCode = 1
}

function createDaemon(): SourcefedDaemon {
  return new SourcefedDaemon({
    stateDir: process.env.SOURCEFED_STATE_DIR,
  })
}

async function runDaemon(args: string[]): Promise<void> {
  const port = Number(flag(args, "port") ?? process.env.SOURCEFED_DAEMON_PORT ?? 18787)
  const hostname = flag(args, "host") ?? process.env.SOURCEFED_DAEMON_HOST ?? "127.0.0.1"
  const token = process.env.SOURCEFED_DAEMON_TOKEN
  if (!isLoopback(hostname) && !token) {
    throw new Error("binding the daemon to a non-loopback address requires SOURCEFED_DAEMON_TOKEN")
  }
  const daemon = createDaemon()
  await daemon.start()
  let server
  try {
    server = await serveHttp({
      hostname,
      port,
      handler: (request) => handleDaemonHttpRequest(daemon, request, { token }),
    })
    const webhookServer = await startWebhookServer(daemon.runtime)
    console.error(webhookServer ? `[sourcefed] webhook listener on http://${process.env.SOURCEFED_WEBHOOK_HOST ?? "127.0.0.1"}:${webhookServer.port}` : "[sourcefed] no separate webhook listener (webhooks served on daemon port)")
  } catch (error) {
    await daemon.stop()
    throw error
  }
  console.error(`[sourcefed] daemon on http://${hostname}:${server.port} (rpc, events, webhooks)`)
  await new Promise<void>(() => {})
}

function isLoopback(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "::1" || hostname === "localhost"
}

async function runMcp(args: string[]): Promise<void> {
  const mode = args[0] ?? "--stdio"
  if (mode === "--stdio") {
    const daemon = createDaemon()
    const mcp = createSourcefedStdio(daemon)
    await daemon.start()
    const webhookServer = await startWebhookServer(mcp.runtime)
    await serveStdio(mcp.factory)
    await webhookServer?.stop()
    await mcp.close()
    return
  }

  if (mode !== "--http") {
    throw new Error("mcp expects --stdio or --http")
  }

  const port = Number(flag(args, "port") ?? process.env.SOURCEFED_MCP_PORT ?? 18788)
  const hostname = flag(args, "host") ?? process.env.SOURCEFED_MCP_HOST ?? "127.0.0.1"
  const token = process.env.SOURCEFED_DAEMON_TOKEN
  if (!isLoopback(hostname) && !token) {
    throw new Error("binding the MCP server to a non-loopback address requires SOURCEFED_DAEMON_TOKEN")
  }
  const daemon = createDaemon()
  const mcp = createSourcefedMcp(daemon)
  await daemon.start()
  let server
  try {
    server = await serveHttp({
      hostname,
      port,
      handler: (request) => {
        const url = new URL(request.url)
        if (url.pathname === "/mcp" && token && request.headers.get("authorization") !== `Bearer ${token}`) {
          return new Response("unauthorized", { status: 401 })
        }
        return url.pathname === "/mcp" ? mcp.handler.fetch(request) : daemon.webhook(request)
      },
    })
  } catch (error) {
    await mcp.close()
    throw error
  }
  console.error(`[sourcefed] MCP server on http://${hostname}:${server.port}/mcp`)
  await new Promise<void>(() => {})
}

async function startWebhookServer(runtime: SourcefedDaemon["runtime"]): Promise<HttpServer | undefined> {
  const enabled = Boolean(
    process.env.SOURCEFED_ENABLE_WEBHOOKS === "1" ||
    process.env.SOURCEFED_WEBHOOK_PORT ||
    process.env.SOURCEFED_GITHUB_WEBHOOK_SECRET ||
    process.env.SOURCEFED_SLACK_SIGNING_SECRET,
  )
  if (!enabled) return undefined

  try {
    return await serveHttp({
      hostname: process.env.SOURCEFED_WEBHOOK_HOST ?? "127.0.0.1",
      port: Number(process.env.SOURCEFED_WEBHOOK_PORT ?? 8788),
      handler: (request) => runtime.webhook(request),
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
  const clientOptions: DaemonClientOptions = {
    name: "sourcefed-cli",
    url: process.env.SOURCEFED_DAEMON_URL ?? defaultDaemonUrl(),
  }
  const client = await connectDaemonClient(clientOptions)
  try {
    if (subcommand === "list") {
      const result = (await client.request("monitor.list", { target })) as { ok?: boolean; monitors?: MonitorView[] }
      printMonitors(result?.monitors ?? [])
      return
    }

    if (subcommand === "logs") {
      const result = (await client.request("monitor.logs", { target })) as { logs?: LogEntryView[] }
      printLogs(result?.logs ?? [])
      return
    }

    if (subcommand === "sources") {
      printResult(await client.request("daemon.sourceTypes"))
      return
    }

    const id = flag(args, "id")
    if ((subcommand === "status" || subcommand === "stop" || subcommand === "start" || subcommand === "remove") && !id) throw new Error(`${subcommand} requires --id`)
    if (subcommand === "status" || subcommand === "stop" || subcommand === "start") {
      printResult(await client.request(`monitor.${subcommand}`, { target, id }))
      return
    }

    if (subcommand === "remove") {
      if (!args.includes("--yes")) throw new Error("remove is destructive: pass --yes to confirm")
      printResult(await client.request("monitor.remove", { target, id }))
      return
    }

    if (subcommand === "events") {
      printResult(await client.request("monitor.events", { target }))
      return
    }

    if (subcommand === "ack") {
      const eventIDs = (flag(args, "event-id") ?? "").split(",").filter(Boolean)
      if (eventIDs.length === 0) throw new Error("ack requires --event-id <id>[,<id>...]")
      printResult(await client.request("monitor.ack", { target, eventIDs }))
      return
    }

    if (subcommand === "create") {
      const sourceType = flag(args, "source-type")
      const sourceTypes = (await client.request("daemon.sourceTypes")) as { sourceTypes?: string[] }
      if (!sourceType || !sourceTypes.sourceTypes?.includes(sourceType)) {
        throw new Error(`create requires --source-type ${sourceTypes.sourceTypes?.join("|") ?? "unknown"}`)
      }
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
      const pollIntervalSec = flag(args, "poll-interval-sec")
      if (pollIntervalSec) input.pollIntervalSec = Number(pollIntervalSec)
      printResult(await client.request("monitor.create", input))
      return
    }
  } finally {
    await client.close()
  }

  throw new Error("monitor expects create, list, status, stop, start, remove, events, ack, logs, or sources")
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}

function printMonitors(monitors: MonitorView[]): void {
  if (monitors.length === 0) {
    console.log(dim("no monitors for this target"))
    return
  }
  for (const monitor of monitors) {
    const status = monitor.enabled ? green("enabled") : red("stopped")
    const delivery = dim(monitor.delivery)
    console.log(`${monitor.icon} ${monitor.describe}  ${status}  ${delivery}`)
  }
}

function printLogs(logs: LogEntryView[]): void {
  if (logs.length === 0) {
    console.log(dim("no notifications sent yet"))
    return
  }
  for (const entry of logs) {
    const time = dim(new Date(entry.at).toLocaleString())
    const marker = entry.actionable ? yellow("▶") : dim("·")
    console.log(`${marker} ${entry.icon} ${time} ${entry.describe}`)
    console.log(`    ${entry.summary}`)
    if (entry.body) console.log(dim(`    ${entry.body}`))
  }
}

function green(text: string): string {
  return `\x1b[32m${text}\x1b[0m`
}

function red(text: string): string {
  return `\x1b[31m${text}\x1b[0m`
}

function yellow(text: string): string {
  return `\x1b[33m${text}\x1b[0m`
}

function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`
}

function printResult(result: unknown): void {
  console.log(JSON.stringify(result, null, 2))
}

function printUsage(): void {
  console.error("sourcefed daemon [--port PORT] [--host HOST]")
  console.error("sourcefed mcp --stdio|--http [--port PORT]")
  console.error("sourcefed monitor create|list|status|stop|start|remove|events|ack|logs|sources [options]")
  console.error("sourcefed skills [list|get <name>|path [name]]")
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
