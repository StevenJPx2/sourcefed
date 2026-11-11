import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { createServer } from "node:https"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { openEventResponse } from "./event-transport.ts"

test("SSE HTTPS transport rejects an untrusted certificate", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sourcefed-tls-"))
  let server: ReturnType<typeof createServer> | undefined
  try {
    const key = path.join(dir, "key.pem")
    const cert = path.join(dir, "cert.pem")
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-subj", "/CN=localhost", "-keyout", key, "-out", cert], { stdio: "ignore", timeout: 10_000 })
    server = createServer({ key: await readFile(key), cert: await readFile(cert) }, (_request, response) => response.end())
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    assert.ok(address && typeof address === "object")
    await assert.rejects(openEventResponse("https://127.0.0.1:" + address.port, {}, AbortSignal.timeout(2_000)), /self.signed|certificate/i)
  } finally {
    if (server) {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server?.close(() => resolve()))
    }
    await rm(dir, { recursive: true, force: true })
  }
})
