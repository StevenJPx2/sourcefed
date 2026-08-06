import path from "node:path"
import { readdirSync, readFileSync } from "node:fs"
import { assert, assertEqual, removeDir, run, sleep, startProcess, tempDir, waitForReachable } from "./harness.mjs"

const dir = await tempDir("sourcefed-it-public-")
const url = "http://127.0.0.1:18921"
const env = { SOURCEFED_STATE_DIR: dir, SOURCEFED_DAEMON_URL: url }
const bin = path.resolve("node_modules/.bin/sourcefed")

try {
  const packageDir = path.resolve("node_modules/@fdcn/sourcefed")
  const distFiles = readdirSync(path.join(packageDir, "dist"))
  assert(!distFiles.some((name) => /\.tsx?$/.test(name)), "dist ships no TypeScript sources")

  const core = await import("@fdcn/sourcefed/core")
  assert(core.MonitorService || core.JsonMonitorStore || Object.keys(core).length > 0, "core subpath imports")
  const daemon = await import("@fdcn/sourcefed/daemon")
  assertEqual(typeof daemon.connectDaemonClient, "function", "daemon subpath imports")
  const mcp = await import("@fdcn/sourcefed/mcp")
  assertEqual(typeof mcp.createSourcefedMcp, "function", "mcp subpath imports")

  const skills = run(bin, ["skills", "list"], { env })
  assert(skills.includes("core:"), "aggregate CLI serves skills")

  const daemonProcess = startProcess(bin, ["daemon", "--port", "18921"], { env, silent: true })
  try {
    await waitForReachable(url)
    const sources = run(bin, ["monitor", "sources"], { env })
    assert(sources.includes("jira") && sources.includes("github") && sources.includes("slack"), "aggregate CLI lists sources")

    const created = JSON.parse(run(bin, ["monitor", "create", "--source-type", "jira", "--issue-key", "PROJ-1", "--name", "PROJ-1", "--target-kind", "it", "--target-id", "pub-1"], { env }))
    assert(created.ok && created.created, "aggregate CLI creates a monitor against its own daemon")
  } finally {
    await daemonProcess.stop()
  }

  console.log("public package: tarball hygiene, subpath imports, bin, daemon+RPC — ok")
} finally {
  await removeDir(dir)
}
