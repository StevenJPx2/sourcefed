import path from "node:path"
import { readFileSync } from "node:fs"
import { assert, assertEqual, removeDir, run, sleep, startProcess, tempDir, waitForReachable } from "./harness.mjs"

const CLI = path.resolve("node_modules/@sourcefed/cli/dist/index.js")
const dir = await tempDir("sourcefed-it-cli-")
const url = "http://127.0.0.1:18920"
const env = { SOURCEFED_STATE_DIR: dir, SOURCEFED_DAEMON_URL: url }
const daemonProcess = startProcess(process.execPath, [CLI, "daemon", "--port", "18920"], { env, silent: true })
try {
  await waitForReachable(url)

  const created = JSON.parse(run(process.execPath, [CLI, "monitor", "create", "--source-type", "jira", "--issue-key", "PROJ-1", "--name", "PROJ-1", "--target-kind", "it", "--target-id", "cli-1"], { env }))
  assert(created.ok && created.created, "create via CLI")

  const listed = run(process.execPath, [CLI, "monitor", "list", "--target-kind", "it", "--target-id", "cli-1"], { env })
  assert(listed.includes("PROJ-1") && listed.includes("enabled"), "list via CLI")

  const id = JSON.parse(readFileSync(path.join(dir, "monitors.json"), "utf8")).monitors[0].id
  const status = JSON.parse(run(process.execPath, [CLI, "monitor", "status", "--id", id, "--target-kind", "it", "--target-id", "cli-1"], { env }))
  assert(status.ok && status.monitor.enabled, "status via CLI")

  const stopped = JSON.parse(run(process.execPath, [CLI, "monitor", "stop", "--id", id, "--target-kind", "it", "--target-id", "cli-1"], { env }))
  assert(stopped.ok && !stopped.monitor.enabled, "stop via CLI")

  const skills = run(process.execPath, [CLI, "skills", "list"], { env })
  assert(skills.includes("core:"), "skills list serves the core guide")
  const guide = run(process.execPath, [CLI, "skills", "get", "core"], { env })
  assert(guide.includes("# Sourcefed core"), "skills get serves content")

  await daemonProcess.stop()
  const restarted = startProcess(process.execPath, [CLI, "daemon", "--port", "18920"], { env, silent: true })
  await waitForReachable(url)
  await restarted.stop()
  console.log("cli: installed binary daemon + monitor CRUD + skills + lock release — ok")
} finally {
  await daemonProcess.stop().catch(() => {})
  await removeDir(dir)
}
