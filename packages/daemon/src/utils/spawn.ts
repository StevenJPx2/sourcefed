import { spawn, type ChildProcess } from "node:child_process"
import path from "node:path"

export const DEFAULT_DAEMON_URL = "http://127.0.0.1:18787"

export function defaultDaemonUrl(): string {
  const port = process.env.SOURCEFED_DAEMON_PORT ?? 18787
  return `http://127.0.0.1:${port}`
}

export function daemonCommand(cliEntryPath: string): { command: string; args: string[] } {
  return {
    command: nodeExecutable(),
    args: [cliEntryPath, "daemon", "--http"],
  }
}

function nodeExecutable(): string {
  const base = path.basename(process.execPath)
  if (base.includes("node") || base.includes("bun")) return process.execPath
  return "node"
}

export async function spawnLocalDaemon(options: {
  command: string
  args: string[]
  env?: Record<string, string>
  port?: number
  timeoutMs?: number
}): Promise<{ url: string; proc?: ChildProcess }> {
  const port = options.port ?? Number(process.env.SOURCEFED_DAEMON_PORT ?? 18787)
  const url = `http://127.0.0.1:${port}`
  const token = options.env?.SOURCEFED_DAEMON_TOKEN ?? process.env.SOURCEFED_DAEMON_TOKEN

  if (await daemonReachable(url, 750, token)) return { url }

  const proc = spawn(options.command, [...options.args, "--port", String(port)], {
    stdio: ["ignore", "ignore", "ignore"],
    detached: true,
    env: { ...process.env, ...options.env },
  })
  proc.unref()

  if (!(await waitForDaemon(url, options.timeoutMs ?? 10_000, token))) {
    proc.kill()
    throw new Error(`sourcefed daemon did not start at ${url}`)
  }
  return { url, proc }
}

async function daemonReachable(url: string, timeoutMs: number, token?: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${url}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ method: "daemon.sourceTypes" }),
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function waitForDaemon(url: string, timeoutMs: number, token?: string): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await daemonReachable(url, 750, token)) return true
    await sleep(150)
  }
  return false
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
