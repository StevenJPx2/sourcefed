import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { command, digest, environment } from "./harness.mjs"
import { freePort, startJsonServer, stopProcess } from "../integration/harness.mjs"

export async function terminalGate(context) {
  const directory = path.join(context.work, "real-tui")
  // Unix sockets need a short path; all application state stays in the owned profile.
  const runtime = await mkdtemp("/tmp/sourcefed-tc-")
  const env = await environment(directory, { TERMCTRL_RUNTIME_DIR: runtime })
  const termctrl = context.options.termctrl ?? (await command("which", ["termctrl"], { cwd: directory, env })).stdout.trim()
  const captures = await mkdtemp(path.join(context.root, ".release/tui-" + context.sha256.slice(0, 8) + "-"))
  const fixture = await startJsonServer(() => ({ body: { fields: { status: { name: "Open" } }, changelog: { histories: [] }, comments: [] } }))
  Object.assign(env, { SOURCEFED_STATE_DIR: path.join(directory, "daemon"),
    SOURCEFED_JIRA_BASE_URL: `http://127.0.0.1:${fixture.port}`, ATLASSIAN_EMAIL: "release@example.invalid", ATLASSIAN_API_KEY: "fixture-key" })
  const port = await freePort()
  env.SOURCEFED_DAEMON_URL = `http://127.0.0.1:${port}`
  const daemon = spawn(process.execPath, [path.join(context.packageDir, "dist/cli.js"), "daemon", "--port", String(port)], { cwd: directory, env, stdio: "ignore" })
  const session = "sourcefed-release"
  const tc = (args) => command(termctrl, args, { cwd: directory, env, timeout: 45000 })
  let started = false
  let host
  try {
    const version = (await tc(["--version"])).stdout.trim()
    const config = path.join(env.XDG_CONFIG_HOME, "opencode")
    await mkdir(config, { recursive: true })
    await writeFile(path.join(config, "opencode.json"), JSON.stringify({ plugins: [context.packageDir] }))
    env.OPENCODE_PASSWORD = "sourcefed-isolated-tui-password"
    host = await privateHost(directory, env)
    await seedMonitor(env.SOURCEFED_DAEMON_URL, host.sessionID)
    await tc(["start", session, "--host", "opentui", "--cols", "132", "--rows", "42",
      "--record", path.join(captures, "opencode.termctrl"), "--", "opencode", "--server", host.url, "--session", host.sessionID])
    started = true
    // The session title also contains "Sourcefed"; wait for the sidebar section.
    await tc(["wait", session, "Sourcefed (1)", "--timeout", "30000"])
    await capture(tc, session, captures, "sidebar", ["Sourcefed (1)", "Release fixture"])
    await tc(["send", session, "text:/sourcefed"])
    await tc(["wait", session, "Show, stop, start, or delete", "--timeout", "10000"])
    await tc(["send", session, "enter"])
    await tc(["wait", session, "Sourcefed monitors (1 active)", "--timeout", "15000"])
    await capture(tc, session, captures, "monitors", ["Sourcefed monitors (1 active)", "Jira PROJ-1", "esc close"])
    await tc(["send", session, "escape"])
    await waitGone(tc, session, "Sourcefed monitors")
    await tc(["send", session, "text:/sourcefed-logs"])
    await tc(["wait", session, "Show recent Sourcefed notifications", "--timeout", "10000"])
    await tc(["send", session, "enter"])
    // The command description also contains "Sourcefed notifications"; the dialog
    // title is the only text with a count.
    await tc(["wait", session, "Sourcefed notifications (", "--timeout", "15000"])
    await capture(tc, session, captures, "logs", ["Sourcefed notifications (0)", "No notifications sent yet"])
    return await captureEvidence(context, captures, termctrl, version)
  } catch (error) {
    if (started) {
      await tc(["save", session, "--format", "txt", "--format", "png", "--out", path.join(captures, "failure")]).catch(() => {})
    }
    throw new Error(`${error.message}; TUI evidence: ${captures}`, { cause: error })
  } finally {
    if (started) await tc(["stop", session]).catch(() => {})
    await tc(["prune"]).catch(() => {})
    if (host) await stopProcess(host.process)
    await stopProcess(daemon)
    await fixture.stop()
    await rm(runtime, { recursive: true, force: true })
  }
}

async function captureEvidence(context, captures, termctrl, version) {
  const files = []
  for (const name of ["sidebar", "monitors", "logs"]) {
    for (const extension of ["png", "txt"]) {
      const file = path.join(captures, `${name}.${extension}`)
      files.push({ path: file, sha256: await digest(file) })
    }
  }
  const result = { artifact: context.artifact, sha256: context.sha256, integrity: context.integrity,
    commit: context.commit, version: context.version, terminal: termctrl, terminalVersion: version, files, isolated: true,
    humanReviewRequired: true, recording: path.join(captures, "opencode.termctrl") }
  await writeFile(path.join(captures, "evidence.json"), JSON.stringify(result, null, 2))
  return result
}

async function privateHost(directory, env) {
  const port = await freePort()
  const url = `http://127.0.0.1:${port}`
  const process_ = spawn("opencode", ["serve", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: directory, env, stdio: "ignore",
  })
  const request = async (route, body) => {
    const response = await fetch(url + route, {
      method: body ? "POST" : "GET", signal: AbortSignal.timeout(5000),
      headers: { "content-type": "application/json", authorization: "Basic " + Buffer.from("opencode:" + env.OPENCODE_PASSWORD).toString("base64") },
      body: body ? JSON.stringify(body) : undefined,
    })
    assert.equal(response.ok, true)
    const value = await response.json()
    return value.data ?? value
  }
  const deadline = Date.now() + 15000
  try {
    while (Date.now() < deadline) {
      if (await request("/api/info").then(() => true, () => false)) {
        const session = await request("/api/session", { location: { directory }, title: "Sourcefed release fixture" })
        return { process: process_, url, sessionID: session.id }
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    throw new Error("private OpenCode host did not start")
  } catch (error) {
    await stopProcess(process_)
    throw error
  }
}

async function waitGone(tc, session, text) {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    const frame = await tc(["show", session, "--settle-ms", "50", "--deadline-ms", "1000"])
    if (!frame.stdout.includes(text)) return
  }
  throw new Error(`terminal still shows ${text}`)
}

async function capture(tc, session, directory, name, expected) {
  await tc(["save", session, "--format", "txt", "--format", "png", "--out", path.join(directory, name)])
  const text = await readFile(path.join(directory, name + ".txt"), "utf8")
  assert.ok(!/plugin.*failed|unhandled|TypeError/i.test(text), text)
  for (const fragment of expected) assert.ok(text.includes(fragment), `${name} capture lacks ${fragment}`)
}

async function seedMonitor(url, sessionID) {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    const response = await fetch(url + "/rpc", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "monitor.create", params: { name: "Release fixture", sourceType: "jira", issueKey: "PROJ-1",
        target: { kind: "opencode-session", id: sessionID } } }), signal: AbortSignal.timeout(1000),
    }).catch(() => undefined)
    if (response) {
      const result = await response.json()
      assert.equal(result.result.ok, true)
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error("isolated TUI daemon did not start")
}
