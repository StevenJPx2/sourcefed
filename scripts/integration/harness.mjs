import { spawn, spawnSync } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:http"
import os from "node:os"
import path from "node:path"

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

export async function waitForReachable(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/rpc`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "daemon.sourceTypes" }),
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
    env: { ...process.env, ...options.env },
    stdio: options.silent ? ["ignore", "ignore", "ignore"] : ["ignore", "inherit", "inherit"],
  })
  let stopped = false
  return {
    proc,
    stop: () => new Promise((resolve) => {
      if (stopped || proc.exitCode !== null) {
        resolve()
        return
      }
      stopped = true
      proc.once("exit", () => resolve())
      proc.kill()
    }),
  }
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
  const result = spawnSync(command, args, { cwd: options.cwd, env: { ...process.env, ...options.env }, encoding: "utf8" })
  if (result.status !== 0) {
    throw new Error(`command failed (${command} ${args.join(" ")}): ${result.stderr || result.stdout}`)
  }
  return result.stdout
}
