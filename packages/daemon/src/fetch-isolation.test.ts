import assert from "node:assert/strict"
import { spawnSync, spawn } from "node:child_process"
import { createServer, type ServerResponse } from "node:http"
import { test } from "node:test"
import type { QueuedMonitorEvent } from "@sourcefed/core"
import { decodeTarget } from "./utils/target.ts"

const target = { kind: "test", id: "0" }
const queued: QueuedMonitorEvent = {
  id: "budget-event", monitorID: "budget-monitor", target, queuedAt: "2026-11-10T00:00:00Z",
  event: { source: { type: "github", repo: "example/test", prNumber: 1 }, kind: "ci",
    at: "2026-11-10T00:00:00Z", summary: "Test event", actionable: true },
}

function probeScript(url: string, entry: string): string {
  return [
    "import { connectDaemonClient } from " + JSON.stringify(entry) + ";",
    "const url = " + JSON.stringify(url) + ";",
    'const client = await connectDaemonClient({ name: "fetch-budget", url });',
    "let deliveries = 0;",
    "try {",
    "  const listeners = [];",
    "  for (let i = 0; i < 300; i++) {",
    '    listeners.push(await client.subscribe({ kind: "test", id: String(i) }, async () => { deliveries++; }));',
    '    if (i === 255) await (await fetch(url + "/capacity", { signal: AbortSignal.timeout(1500) })).text();',
    "  }",
    '  const response = await fetch(url + "/health", { signal: AbortSignal.timeout(1500) });',
    '  if (await response.text() !== "healthy") throw new Error("unrelated fetch failed");',
    "  const deadline = Date.now() + 2000;",
    "  while (!deliveries && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));",
    '  if (deliveries !== 1) throw new Error("event delivery failed");',
    "  await Promise.all(listeners.map(listener => listener.close()));",
    '  console.log("responsive");',
    "} finally { await client.close(); }",
  ].join("\n")
}

// A separate Bun process proves the runtime's real fetch budget, not a mocked fetch.
test("Bun SSE subscriptions leave unrelated fetch and acknowledgement responsive and release sockets", { timeout: 25_000 }, async (t) => {
  const bun = process.env.SOURCEFED_TEST_BUN ?? "bun"
  if (spawnSync(bun, ["--version"], { timeout: 2_000 }).error) {
    t.skip("Bun is required for the fetch-budget runtime contract")
    return
  }
  const active = new Set<ServerResponse>()
  let opened = 0
  let acknowledgements = 0
  const server = createServer((request, response) => {
    if (request.url?.startsWith("/events")) {
      active.add(response)
      opened += 1
      response.on("close", () => active.delete(response))
      response.writeHead(200, { "content-type": "text/event-stream" })
      const target = decodeTarget(new URL(request.url, "http://localhost").searchParams.get("target") ?? "")
      assert.ok(target)
      response.write("data: " + JSON.stringify({ type: "subscribed", target }) + "\n\n")
    } else if (request.url === "/rpc") {
      request.resume()
      acknowledgements += 1
      response.end('{"result":{"ok":true}}')
    } else {
      if (request.url === "/health") active.values().next().value?.write("data: " + JSON.stringify({ type: "event", target, events: [queued] }) + "\n\n")
      response.end("healthy")
    }
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  assert.ok(address && typeof address === "object")
  const script = probeScript("http://127.0.0.1:" + address.port, new URL("../dist/index.js", import.meta.url).href)
  const child = spawn(bun, ["--eval", script], {
    env: { PATH: process.env.PATH, BUN_CONFIG_MAX_HTTP_REQUESTS: "256" }, stdio: ["ignore", "pipe", "pipe"],
  })
  t.signal.addEventListener("abort", () => child.kill("SIGKILL"), { once: true })
  let output = ""
  child.stdout.on("data", (chunk) => { output += String(chunk) })
  child.stderr.on("data", (chunk) => { output += String(chunk) })
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject)
      child.once("exit", resolve)
    })
    assert.equal(code, 0, output)
    assert.match(output, /responsive/)
    assert.equal(opened, 300)
    assert.equal(acknowledgements, 1)
    const deadline = Date.now() + 2_000
    while (active.size && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10))
    assert.equal(active.size, 0)
  } finally {
    child.kill()
    for (const response of active) response.destroy()
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
