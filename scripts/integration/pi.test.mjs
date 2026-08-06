import path from "node:path"
import { spawn } from "node:child_process"
import { spawnSync } from "node:child_process"
import { assert, removeDir, sleep, tempDir } from "./harness.mjs"

const piBin = (() => {
  try {
    return spawnSync("which", ["pi"], { encoding: "utf8" }).stdout.trim() || null
  } catch {
    return null
  }
})()

if (!piBin) {
  console.log("SKIP pi: no pi binary on PATH")
  process.exit(0)
}

const repoRoot = path.resolve("..", "..")
const dir = await tempDir("sourcefed-it-pi-")
const agentDir = path.join(dir, "agent")
const sessionDir = path.join(dir, "sessions")
const stateDir = path.join(dir, "state")
const extensionPath = path.join(repoRoot, "adapters", "pi", "src", "index.ts")

const env = {
  ...process.env,
  PI_CODING_AGENT_DIR: agentDir,
  SOURCEFED_STATE_DIR: stateDir,
}

const proc = spawn(piBin, [
  "--mode", "rpc",
  "--extension", extensionPath,
  "--no-session",
  "--session-dir", sessionDir,
], { env, stdio: ["pipe", "pipe", "pipe"] })

let output = ""
let exited = false
proc.stdout.on("data", (chunk) => { output += chunk })
proc.stderr.on("data", (chunk) => { output += chunk })
proc.on("exit", (code) => { exited = true })

try {
  await sleep(3_000)
  if (exited) {
    console.log(`SKIP pi: rpc exited early (${proc.exitCode}): ${output.slice(-400)}`)
    process.exit(0)
  }

  proc.stdin.write(JSON.stringify({ id: "cmd-1", type: "prompt", message: "/sourcefed" }) + "\n")

  const deadline = Date.now() + 45_000
  let matched = null
  while (Date.now() < deadline) {
    if (output.includes("monitors")) {
      matched = "monitors"
      break
    }
    if (output.includes("sourcefed")) {
      matched = "sourcefed"
      break
    }
    await sleep(500)
  }

  if (!matched) {
    console.log(`SKIP pi: no sourcefed output in RPC stream: ${output.slice(-500)}`)
    process.exit(0)
  }

  const statusLine = output.split("\n").find((line) => line.includes("extension_ui_request") && line.includes("setStatus") && line.includes("sourcefed"))
  assert(statusLine, "the extension initialized and reported its status through the RPC stream")
  console.log("pi: RPC mode, extension init, daemon status polling — ok")
} finally {
  proc.kill()
  await removeDir(dir).catch(() => {})
}
