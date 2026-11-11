import path from "node:path"
import { readFileSync } from "node:fs"
import { assert, assertEqual, freePort, removeDir, run, sleep, startJsonServer, startProcess, tempDir, waitForReachable } from "./harness.mjs"

const CLI = path.resolve("node_modules/.bin/sourcefed")
const dir = await tempDir("sourcefed-it-cli-")
const port = await freePort()
const url = `http://127.0.0.1:${port}`
const fixture = await startJsonServer(() => ({ body: { fields: { status: { name: "Open" } }, changelog: { histories: [] }, comments: [] } }))
const env = { SOURCEFED_STATE_DIR: dir, SOURCEFED_DAEMON_URL: url,
  SOURCEFED_JIRA_BASE_URL: `http://127.0.0.1:${fixture.port}`,
  ATLASSIAN_EMAIL: "release@example.invalid", ATLASSIAN_API_KEY: "fixture-key",
}
const daemonProcess = startProcess(CLI, ["daemon", "--port", String(port)], { env, silent: true })
try {
  await waitForReachable(url)

  const created = JSON.parse(run(CLI, ["monitor", "create", "--source-type", "jira", "--issue-key", "PROJ-1", "--name", "PROJ-1", "--target-kind", "it", "--target-id", "cli-1"], { env }))
  assert(created.ok && created.created, "create via CLI")

  const listed = run(CLI, ["monitor", "list", "--target-kind", "it", "--target-id", "cli-1"], { env })
  assert(listed.includes("PROJ-1") && listed.includes("enabled"), "list via CLI")

  const id = JSON.parse(readFileSync(path.join(dir, "monitors.json"), "utf8")).monitors[0].id
  const status = JSON.parse(run(CLI, ["monitor", "status", "--id", id, "--target-kind", "it", "--target-id", "cli-1"], { env }))
  assert(status.ok && status.monitor.enabled, "status via CLI")

  const stopped = JSON.parse(run(CLI, ["monitor", "stop", "--id", id, "--target-kind", "it", "--target-id", "cli-1"], { env }))
  assert(stopped.ok && !stopped.monitor.enabled, "stop via CLI")

  const skills = run(CLI, ["skills", "list"], { env })
  assert(skills.includes("core:"), "skills list serves the core guide")
  const guide = run(CLI, ["skills", "get", "core"], { env })
  assert(guide.includes("# Sourcefed core"), "skills get serves content")

  const started = JSON.parse(run(CLI, ["monitor", "start", "--id", id, "--target-kind", "it", "--target-id", "cli-1"], { env }))
  assert(started.ok && started.monitor.enabled, "start via installed bin")
  run(CLI, ["monitor", "logs", "--target-kind", "it", "--target-id", "cli-1"], { env })
  const removed = JSON.parse(run(CLI, ["monitor", "remove", "--yes", "--id", id, "--target-kind", "it", "--target-id", "cli-1"], { env }))
  assert(removed.ok, "remove via installed bin")

  await daemonProcess.stop()
  const restarted = startProcess(CLI, ["daemon", "--port", String(port)], { env, silent: true })
  await waitForReachable(url)
  await restarted.stop()
  console.log("cli: installed binary daemon + monitor CRUD + skills + lock release — ok")
} finally {
  await daemonProcess.stop().catch(() => {})
  await fixture.stop()
  await removeDir(dir)
}
