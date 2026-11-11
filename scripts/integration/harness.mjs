import { spawn, spawnSync } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { createServer } from "node:http"
import { createServer as createPortReservation } from "node:net"
import { once } from "node:events"
import os from "node:os"
import path from "node:path"

let isolation

export function cleanEnvironment(extra = {}) {
  if (!isolation) {
    isolation = mkdtempSync(path.join(os.tmpdir(), "sourcefed-env-"))
    process.once("exit", () => rmSync(isolation, { recursive: true, force: true }))
  }
  const env = {
    PATH: process.env.PATH, HOME: path.join(isolation, "home"), TMPDIR: isolation,
    XDG_CONFIG_HOME: path.join(isolation, "config"), XDG_DATA_HOME: path.join(isolation, "data"),
    XDG_STATE_HOME: path.join(isolation, "state"), XDG_CACHE_HOME: path.join(isolation, "cache"),
    PI_CODING_AGENT_DIR: path.join(isolation, "pi"),
    OPENCODE_DB: path.join(isolation, "opencode.sqlite"),
    npm_config_cache: path.join(isolation, "npm"),
    npm_config_fetch_timeout: "20000", npm_config_fetch_retries: "0",
    ...extra,
  }
  for (const key of ["HOME", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "XDG_CACHE_HOME", "PI_CODING_AGENT_DIR"]) {
    mkdirSync(env[key], { recursive: true })
  }
  return env
}

export function daemonEntry() {
  return process.env.SOURCEFED_TEST_DAEMON_ENTRY ?? "@sourcefed/daemon"
}

export function assert(condition, message) {
  if (!condition) throw new Error(message ?? "assertion failed")
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message ?? "assertion"} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function tempDir(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix))
}

export async function removeDir(dir) {
  await rm(dir, { recursive: true, force: true })
}

export async function freePort() {
  const server = createPortReservation()
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = server.address()
  await new Promise((resolve) => server.close(resolve))
  if (!address || typeof address === "string") throw new Error("no test port allocated")
  return address.port
}

export async function waitForReachable(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/rpc`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "daemon.sourceTypes" }),
        signal: AbortSignal.timeout(1_000),
      })
      if (response) return
    } catch {
      // not up yet
    }
    await sleep(200)
  }
  throw new Error(`daemon at ${url} did not become reachable within ${timeoutMs}ms`)
}

export function startProcess(command, args, options = {}) {
  const proc = spawn(command, args, {
    cwd: options.cwd,
    env: cleanEnvironment(options.env),
    stdio: options.silent ? ["ignore", "ignore", "ignore"] : ["ignore", "inherit", "inherit"],
  })
  let stopped = false
  return {
    proc,
    stop: async () => {
      if (stopped) return
      stopped = true
      await stopProcess(proc)
    },
  }
}

export async function stopProcess(proc) {
  if (proc.exitCode !== null || proc.signalCode !== null) return
  const exited = once(proc, "exit")
  proc.kill()
  let timer
  try {
    await Promise.race([exited, new Promise((resolve) => { timer = setTimeout(resolve, 5_000) })])
    if (proc.exitCode === null && proc.signalCode === null) { proc.kill("SIGKILL"); await exited }
  } finally { clearTimeout(timer) }
}

export async function startHostDaemon(env) {
  const port = await freePort()
  const url = `http://127.0.0.1:${port}`
  const cli = path.resolve("node_modules/@fdcn/sourcefed/dist/cli.js")
  const daemon = startProcess(process.execPath, [cli, "daemon", "--port", String(port)], { env: { ...env, SOURCEFED_DAEMON_URL: url }, silent: true })
  try {
    await waitForReachable(url)
    return { url, stop: daemon.stop }
  } catch (error) { await daemon.stop(); throw error }
}

export async function startJsonServer(handler) {
  const server = createServer((request, response) => {
    let body = ""
    request.on("data", (chunk) => { body += chunk })
    request.on("end", async () => {
      try {
        const result = await handler(request, body)
        response.writeHead(result.status ?? 200, { "content-type": "application/json" })
        response.end(JSON.stringify(result.body))
      } catch (error) {
        response.writeHead(500, { "content-type": "application/json" })
        response.end(JSON.stringify({ error: error.message }))
      }
    })
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  return {
    port: typeof address === "object" && address ? address.port : 0,
    stop: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd, env: cleanEnvironment(options.env), encoding: "utf8", timeout: options.timeout ?? 120_000, maxBuffer: 4 * 1024 * 1024 })
  if (result.status !== 0) {
    throw new Error(`command failed (${command} ${args.join(" ")}): ${result.stderr || result.stdout}`)
  }
  return result.stdout
}
