import path from "node:path"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { spawn, spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"
import { assert, freePort, removeDir, sleep, startProcess, stopProcess, tempDir, waitForReachable } from "./harness.mjs"

const opencode = spawnSync("which", ["opencode"], { encoding: "utf8" }).stdout?.trim()
if (!opencode) throw new Error("OpenCode release integration requires the real host on PATH")

const dir = await tempDir("sourcefed-it-opencode-")
const packageDir = path.resolve("node_modules/@fdcn/sourcefed")
const project = path.join(dir, "project")
const state = path.join(dir, "state")
const config = path.join(dir, "config")
const port = await freePort()
const daemonPort = await freePort()
const daemonURL = `http://127.0.0.1:${daemonPort}`
// Never inherit provider credentials, shared service discovery or user configuration.
const env = { PATH: process.env.PATH, HOME: path.join(dir, "home"), XDG_CONFIG_HOME: config,
  XDG_DATA_HOME: path.join(dir, "data"), XDG_STATE_HOME: path.join(dir, "xdg-state"),
  XDG_CACHE_HOME: path.join(dir, "cache"), TMPDIR: dir,
  SOURCEFED_STATE_DIR: state, SOURCEFED_DAEMON_URL: daemonURL }
const plugins = path.join(config, "opencode", "plugins")
await Promise.all([project, state, plugins, env.HOME].map((directory) => mkdir(directory, { recursive: true })))
await writeFile(path.join(config, "opencode", "opencode.json"), JSON.stringify({ plugins: ["*"] }))
await writeFile(path.join(plugins, "sourcefed.js"), `export { default } from ${JSON.stringify(pathToFileURL(path.join(packageDir, "dist/opencode.js")).href)}`)
await writeFile(path.join(plugins, "exercise.js"), toolExercise())
const daemon = startProcess(process.execPath, [path.join(packageDir, "dist/cli.js"), "daemon", "--port", String(daemonPort)], { env, silent: true })
let host
let logs = ""

try {
  await waitForReachable(daemonURL)
  host = spawn(opencode, ["serve", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: project, env, stdio: ["ignore", "pipe", "pipe"] })
  host.stdout.on("data", (chunk) => { logs += chunk })
  host.stderr.on("data", (chunk) => { logs += chunk })
  await waitForHost()
  const session = await api("/api/session", { location: { directory: project }, title: "SourceFed release integration" })
  await api(`/api/session/${session.id}/command`, { name: "sourcefed-integration", text: "" })
  const monitors = JSON.parse(await readFile(path.join(state, "monitors.json"), "utf8")).monitors
  assert(monitors.length === 1, "the registered monitor tool creates exactly one monitor")
  assert(monitors[0].source.type === "jira" && monitors[0].source.issueKey === "PROJ-1", "monitor source matches")
  assert(monitors[0].target.id === session.id, "the real host supplies the session target")
  console.log("opencode: installed aggregate plugin, private real host, registered tool invocation and daemon state — ok")
} catch (error) {
  throw new Error(`${error.message}\n${logs.replace(/server password \S+/g, "server password [redacted]").slice(-3000)}`)
} finally {
  if (host) await stopProcess(host)
  await daemon.stop()
  await removeDir(dir)
}

function toolExercise() {
  return `export default {
    id: "sourcefed-integration",
    async setup(ctx) {
      await ctx.command.transform(editor => editor.add({
        name: "sourcefed-integration",
        async execute({ sessionID }) {
          const tool = (await ctx.tool.list()).find(tool => tool.id === "monitor_create")
          if (!tool) throw new Error("SourceFed monitor_create was not registered")
          const result = await tool.execute({ name: "PROJ-1", sourceType: "jira", issueKey: "PROJ-1" }, { sessionID })
          const output = JSON.parse(result.content)
          if (!output.ok || !output.created) throw new Error("monitor_create failed: " + result.content)
        }
      }))
    }
  }`
}

async function api(route, body) {
  const password = logs.match(/server password (\S+)/)?.[1]
  if (!password) throw new Error("private host has not announced authentication")
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`OpenCode ${response.status}: ${text}`)
  const result = text ? JSON.parse(text) : undefined
  return result?.data ?? result
}

async function waitForHost() {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (host.exitCode !== null) throw new Error(`private host exited: ${host.exitCode}`)
    if (await api("/api/info").then(() => true, () => false)) return
    await sleep(100)
  }
  throw new Error("private OpenCode host did not become ready")
}
