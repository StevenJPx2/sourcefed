import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { createServer as createHttpsServer } from "node:https"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { freePort, sleep, stopProcess } from "./integration/harness.mjs"

// An optional installed package directory exercises both its plugin and transport.
const packageDir = process.argv[2] ? path.resolve(process.argv[2]) : undefined

// Explicitly isolated, provider-free probe of the Bun embedded in the installed host.
await main()

async function main() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sourcefed-http-budget-"))
  const servers = []
  let host
  let logs = ""
  let api
  try {
    const key = path.join(dir, "key.pem")
    const cert = path.join(dir, "cert.pem")
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-subj", "/CN=localhost", "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost", "-keyout", key, "-out", cert], { stdio: "ignore", timeout: 10_000 })
    servers.push(await fixture(), await fixture({ key: await readFile(key), cert: await readFile(cert) }))
    const project = path.join(dir, "project")
    const config = path.join(dir, "config", "opencode")
    await Promise.all([project, path.join(config, "plugins"), path.join(dir, "home")].map((p) => mkdir(p, { recursive: true })))
    const report = path.join(dir, "report.json")
    const plugin = path.join(config, "plugins", "probe.js")
    await writeFile(plugin, pluginSource(servers.map((server) => server.url), report))
    if (packageDir) {
      const entry = pathToFileURL(path.join(packageDir, "dist/opencode.js")).href
      await writeFile(path.join(config, "plugins", "sourcefed.js"), `export { default } from ${JSON.stringify(entry)}`)
    }
    await writeFile(path.join(config, "opencode.json"), JSON.stringify({ plugins: ["*"] }))
    const port = await freePort()
    const env = { PATH: process.env.PATH, HOME: path.join(dir, "home"), TMPDIR: dir,
      XDG_CONFIG_HOME: path.join(dir, "config"), XDG_DATA_HOME: path.join(dir, "data"),
      XDG_STATE_HOME: path.join(dir, "state"), XDG_CACHE_HOME: path.join(dir, "cache"),
      OPENCODE_DB: path.join(dir, "opencode.sqlite"), NODE_EXTRA_CA_CERTS: cert,
      SOURCEFED_DAEMON_URL: servers[0].url,
      BUN_CONFIG_MAX_HTTP_REQUESTS: "256" }
    host = spawn("opencode", ["serve", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: project, env, stdio: ["ignore", "pipe", "pipe"],
    })
    host.stdout.on("data", (chunk) => { logs += chunk })
    host.stderr.on("data", (chunk) => { logs += chunk })
    api = async (route, method = "GET", body) => {
      const password = logs.match(/server password (\S+)/)?.[1]
      assert.ok(password, "private host has not announced authentication")
      const response = await fetch("http://127.0.0.1:" + port + route, {
        method, headers: { "content-type": "application/json", authorization: "Basic " + Buffer.from("opencode:" + password).toString("base64") },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30_000),
      })
      assert.ok(response.ok, await response.clone().text())
      const text = await response.text()
      const result = text ? JSON.parse(text) : undefined
      return result?.data ?? result
    }
    await until(async () => api("/api/info").then(() => true, () => false), 30_000)
    // A location-scoped read loads the plugin without creating any host sessions.
    await api("/api/plugin?directory=" + encodeURIComponent(project))
    await until(() => readFile(report, "utf8").then(() => true, () => false), 30_000)
    const result = JSON.parse(await readFile(report, "utf8"))
    assert.ok(!result.error, JSON.stringify(result))
    for (const server of servers) {
      await until(() => server.active.size === 0, 2_000)
      assert.equal(server.peak(), 300)
      assert.equal(server.acknowledgements(), 1)
    }
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    logs += await readFile(path.join(dir, "data", "opencode", "log", "opencode.log"), "utf8").catch(() => "")
    throw new Error(error.message + "\n" + logs.replace(/server password \S+/g, "server password [redacted]").slice(-3000))
  } finally {
    if (host) await stopProcess(host)
    await Promise.all(servers.map((server) => server.stop()))
    await rm(dir, { recursive: true, force: true })
  }
}

async function until(check, timeout) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await check()) return
    await sleep(10)
  }
  throw new Error("probe condition timed out")
}

async function fixture(tls) {
  const active = new Set()
  let peak = 0
  let acknowledgements = 0
  const handler = (request, response) => {
    const endpoint = new URL(request.url, "http://localhost")
    const authenticated = request.headers.authorization === "Bearer isolated-test-token"
    const bridgeRead = packageDir && endpoint.pathname === "/rpc" && !request.headers.authorization
    if (endpoint.pathname !== "/health" && !authenticated && !bridgeRead) {
      response.writeHead(401)
      response.end("unauthorized")
      return
    }
    if (endpoint.pathname === "/events") {
      const target = JSON.parse(Buffer.from(endpoint.searchParams.get("target"), "base64url").toString())
      active.add(response)
      peak = Math.max(peak, active.size)
      response.on("close", () => active.delete(response))
      response.writeHead(200, { "content-type": "text/event-stream" })
      response.write(target.id === "pending" ? ": waiting\n\n" : "data: " + JSON.stringify({ type: "subscribed", target }) + "\n\n")
    } else if (endpoint.pathname === "/rpc") {
      let body = ""
      request.on("data", (chunk) => { body += chunk })
      request.on("end", () => {
        const { method } = JSON.parse(body)
        if (!authenticated && method !== "monitor.list") {
          response.writeHead(401)
          response.end("unauthorized")
          return
        }
        if (method === "monitor.ack") acknowledgements++
        response.end(JSON.stringify({ result: { ok: true, monitors: [] } }))
      })
    } else {
      const target = { kind: "test", id: "0" }
      const event = { id: "budget-event", monitorID: "budget-monitor", target, queuedAt: "2026-11-10T00:00:00Z",
        event: { source: { type: "github", repo: "example/test", prNumber: 1 }, kind: "ci", at: "2026-11-10T00:00:00Z", summary: "Test event", actionable: true } }
      active.values().next().value?.write("data: " + JSON.stringify({ type: "event", target, events: [event] }) + "\n\n")
      response.end("healthy")
    }
  }
  const server = tls ? createHttpsServer(tls, handler) : createServer(handler)
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  return { url: (tls ? "https" : "http") + "://127.0.0.1:" + server.address().port,
    active, peak: () => peak, acknowledgements: () => acknowledgements,
    async stop() {
      for (const response of active) response.destroy()
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
    } }
}

function pluginSource(urls, report) {
  const entry = packageDir
    ? pathToFileURL(path.join(packageDir, "dist/daemon.js")).href
    : new URL("../packages/sourcefed/dist/daemon.js", import.meta.url).href
  return [
    "import { connectDaemonClient } from " + JSON.stringify(entry) + ";",
    'import { writeFile } from "node:fs/promises";',
    "const exercise = " + exercise.toString() + ";",
    // Setup returns so the host can finish loading the installed Sourcefed plugin.
    'export default { id: "sourcefed-fetch-budget-probe", setup(ctx) { void (async () => {',
    "const result = { opencode: ctx.app.version, bun: Bun.version, revision: Bun.revision, transports: [] };",
    "try {",
    ...(packageDir ? [
      "const deadline = Date.now() + 15000;",
      "while (!(await ctx.tool.list()).some(tool => tool.id === 'monitor_list')) {",
      "  if (Date.now() > deadline) throw new Error('installed Sourcefed plugin did not register tools');",
      "  await new Promise(resolve => setTimeout(resolve, 20));",
      "}",
      "result.installedPluginLoaded = true;",
    ] : []),
    "for (const url of " + JSON.stringify(urls) + ") {",
    '  const client = await connectDaemonClient({ name: "isolated-runtime-probe", url, token: "isolated-test-token" });',
    "  try { result.transports.push(await exercise(client, url)); } finally { await client.close(); }",
    "} } catch (error) { result.error = String(error); }",
    "await writeFile(" + JSON.stringify(report) + ", JSON.stringify(result));",
    "})(); } };",
  ].join("\n")
}

// Serialized into the test plugin: keep dependencies local to this function.
async function exercise(client, url) {
  let deliveries = 0
  const listeners = []
  for (let i = 0; i < 300; i++) {
    listeners.push(await client.subscribe({ kind: "test", id: String(i) }, async () => { deliveries++ }))
  }
  const start = performance.now()
  const response = await fetch(url + "/health", { signal: AbortSignal.timeout(1500) })
  if (await response.text() !== "healthy") throw new Error("unrelated fetch failed")
  const elapsedMs = performance.now() - start
  const deadline = Date.now() + 2_000
  while (!deliveries && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10))
  if (deliveries !== 1) throw new Error("event delivery failed")
  await Promise.all(listeners.map((listener) => listener.close()))
  const controller = new AbortController()
  const pending = client.subscribe({ kind: "test", id: "pending" }, async () => {}, { signal: controller.signal })
    .then(() => { throw new Error("pending setup unexpectedly subscribed") }, (error) => {
      if (!String(error).includes("closed")) throw error
    })
  await new Promise((resolve) => setTimeout(resolve, 50))
  controller.abort()
  await pending
  return { protocol: new URL(url).protocol, subscriptions: 300, deliveries, cancelledSetup: true, unrelatedFetchMs: elapsedMs }
}
