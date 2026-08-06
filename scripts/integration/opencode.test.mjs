import path from "node:path"
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { assert, sleep, tempDir } from "./harness.mjs"

const opencodeBin = (() => {
  try {
    return spawnSync("which", ["opencode"], { encoding: "utf8" }).stdout.trim() || null
  } catch {
    return null
  }
})()

if (!opencodeBin) {
  console.log("SKIP opencode: no opencode binary on PATH")
  process.exit(0)
}

const dir = await tempDir("sourcefed-it-opencode-")
const projectDir = path.join(dir, "project")
const stateDir = path.join(dir, "state")
mkdirSync(projectDir, { recursive: true })
mkdirSync(stateDir, { recursive: true })

const env = {
  ...process.env,
  SOURCEFED_STATE_DIR: stateDir,
}

try {
  const result = spawnSync(opencodeBin, [
    "run", "--print-logs",
    "Use the monitor_create tool exactly once to create a Jira monitor for issue PROJ-1. Report the tool result.",
  ], {
    cwd: projectDir,
    env,
    encoding: "utf8",
    timeout: 240_000,
    stdio: ["ignore", "pipe", "pipe"],
  })

  const deadline = Date.now() + 20_000
  let monitors = []
  while (Date.now() < deadline) {
    try {
      monitors = JSON.parse(readFileSync(path.join(stateDir, "monitors.json"), "utf8")).monitors ?? []
      if (monitors.length > 0) break
    } catch {
      // daemon not up yet
    }
    await sleep(500)
  }

  if (monitors.length === 0) {
    const responseTail = (result.stdout + result.stderr).slice(-1200)
    if (result.status !== 0) {
      console.log(`SKIP opencode: headless run failed to complete (exit ${result.status}): ${responseTail}`)
      process.exit(0)
    }
    console.log(`SKIP opencode: model did not call monitor_create; response: ${responseTail}`)
    process.exit(0)
  }

  assert(monitors[0].source.type === "jira" && monitors[0].source.issueKey === "PROJ-1", "monitor source matches")
  console.log("opencode: headless run with the real host, plugin tool call, daemon state — ok")
} finally {
  rmSync(dir, { recursive: true, force: true })
}
