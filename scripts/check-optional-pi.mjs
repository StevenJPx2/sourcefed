import assert from "node:assert/strict"
import { execFile, spawn } from "node:child_process"
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import os from "node:os"
import { freePort, sleep, stopProcess } from "./integration/harness.mjs"

const exec = promisify(execFile)
const root = fileURLToPath(new URL("../", import.meta.url))
const host = path.join(root, "node_modules/@earendil-works/pi-coding-agent")
const option = (name) => {
  const index = process.argv.indexOf("--" + name)
  return index < 0 ? undefined : process.argv[index + 1]
}

await main()

async function main() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sourcefed-optional-pi-"))
  const env = isolatedEnvironment(dir)

  try {
    const { consumer, archive, installed } = await candidate(dir, env)
    await assertNoPi(consumer)
    const audit = await auditConsumer(consumer, env)
    await run(process.execPath, ["--input-type=module", "--eval", [
      'import assert from "node:assert/strict";',
      'const core = await import("@fdcn/sourcefed/core"); assert.ok(core.MonitorService);',
      'const daemon = await import("@fdcn/sourcefed/daemon"); assert.equal(typeof daemon.connectDaemonClient, "function");',
      'const mcp = await import("@fdcn/sourcefed/mcp"); assert.equal(typeof mcp.createSourcefedMcp, "function");',
    ].join("\n")], consumer, env)
    await run(process.execPath, [path.join(installed, "dist/cli.js"), "skills", "list"], consumer, env)
    const opencode = JSON.parse(await run(process.execPath, [
      path.join(root, "scripts/check-opencode-subscriptions.mjs"), installed,
    ], consumer, env))
    assert.equal(opencode.installedPluginLoaded, true)
    const pi = await checkPi(dir, archive, installed, env)
    console.log(JSON.stringify({ plainInstallHasPi: false, audit, opencode, pi }, null, 2))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function candidate(dir, env) {
  if (option("installed")) {
    const installed = path.resolve(option("installed"))
    const archive = option("tarball") ? path.resolve(option("tarball")) : undefined
    assert.ok(archive || process.argv.includes("--registry"), "installed probes require exact tarball or --registry")
    return { installed, archive, consumer: path.resolve(installed, "../../..") }
  }
  const consumer = path.join(dir, "consumer")
  await mkdir(consumer, { recursive: true })
  await writeFile(path.join(consumer, "package.json"), JSON.stringify({
    name: "sourcefed-plain-install-proof", private: true, type: "module",
  }))
  const packed = JSON.parse(await run("npm", [
    "pack", path.join(root, "packages/sourcefed"), "--json", "--pack-destination", dir,
  ], root, env))
  const archive = path.join(dir, packed[0].filename)
  await run("npm", ["install", archive, "--omit=dev", "--ignore-scripts", "--no-audit"], consumer, env)
  return { consumer, archive, installed: path.join(consumer, "node_modules/@fdcn/sourcefed") }
}

function isolatedEnvironment(dir) {
  return {
    PATH: process.env.PATH, HOME: path.join(dir, "home"), TMPDIR: dir, CI: "true",
    XDG_CONFIG_HOME: path.join(dir, "config"), XDG_DATA_HOME: path.join(dir, "data"),
    XDG_STATE_HOME: path.join(dir, "state"), XDG_CACHE_HOME: path.join(dir, "cache"),
    OPENCODE_DB: path.join(dir, "opencode.sqlite"),
    npm_config_cache: path.join(dir, "cache/npm"), npm_config_ignore_scripts: "true",
    npm_config_fetch_timeout: "20000", npm_config_fetch_retries: "0",
  }
}

async function run(command, args, cwd, env) {
  try {
    const result = await exec(command, args, { cwd, env, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 })
    return result.stdout
  } catch (error) {
    throw new Error(`${command} failed: ${error.stderr ?? ""} ${error.stdout ?? ""}`, { cause: error })
  }
}

async function assertNoPi(directory) {
  const lock = JSON.parse(await readFile(path.join(directory, "package-lock.json"), "utf8"))
  const pi = Object.keys(lock.packages).filter((name) => name.includes("node_modules/@earendil-works/pi-"))
  assert.deepEqual(pi, [], "a plain or Pi-managed extension install downloads no Pi host packages")
  for (const name of ["pi-coding-agent", "pi-tui"]) {
    await assert.rejects(access(path.join(directory, "node_modules/@earendil-works", name)), { code: "ENOENT" })
  }
}

async function auditConsumer(directory, env) {
  let output

  try {
    output = (await exec("npm", ["audit", "--omit=dev", "--json"], {
      cwd: directory, env, timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
    })).stdout
  } catch (error) {
    if (error.code !== 1) throw error
    output = error.stdout
  }

  const report = JSON.parse(output)
  assert.ok(report.metadata, "npm audit returns a report, not a registry error")
  for (const finding of Object.values(report.vulnerabilities)) {
    assert.ok(!finding.nodes.some((node) => node.includes("pi-coding-agent")), finding.name)
  }

  return {
    counts: report.metadata.vulnerabilities,
    advisories: [...new Set(Object.values(report.vulnerabilities).flatMap((finding) =>
      finding.via.filter((cause) => typeof cause !== "string").map((cause) => cause.url),
    ))],
  }
}

async function checkPi(dir, archive, installed, baseEnv) {
  const agent = path.join(dir, "pi-agent")
  const project = path.join(dir, "pi-project")
  const env = { ...baseEnv, PI_CODING_AGENT_DIR: agent, SOURCEFED_STATE_DIR: path.join(dir, "daemon") }
  const manifest = JSON.parse(await readFile(path.join(installed, "package.json"), "utf8"))
  const hostManifest = JSON.parse(await readFile(path.join(host, "package.json"), "utf8"))
  const cli = path.join(host, "dist/cli.js")
  await Promise.all([agent, project].map((p) => mkdir(p, { recursive: true })))
  const wrapper = path.join(dir, "npm-fixture.mjs")
  // Exercise Pi's npm installer without publishing: substitute only this package spec.
  if (archive) {
    await writeFile(wrapper, [
    'import { spawnSync } from "node:child_process";',
    "const spec = " + JSON.stringify(`${manifest.name}@${manifest.version}`) + ";",
    "const archive = " + JSON.stringify(archive) + ";",
    'const args = process.argv.slice(2).map(arg => arg === spec ? archive : arg);',
    'const result = spawnSync("npm", args, { stdio: "inherit", env: process.env, timeout: 90000 });',
    'if (result.error) throw result.error; process.exit(result.status ?? 1);',
  ].join("\n"))
    await writeFile(path.join(agent, "settings.json"), JSON.stringify({ npmCommand: [process.execPath, wrapper] }))
  }
  await run(process.execPath, [cli, "install", `npm:${manifest.name}@${manifest.version}`], project, env)
  await assertNoPi(path.join(agent, "npm"))
  const managed = path.join(agent, "npm/node_modules/@fdcn/sourcefed/dist/pi.js")
  assert.deepEqual(await readFile(managed), await readFile(path.join(installed, "dist/pi.js")))
  const daemonPort = await freePort()
  env.SOURCEFED_DAEMON_URL = `http://127.0.0.1:${daemonPort}`
  const daemon = spawn(process.execPath, [path.join(installed, "dist/cli.js"), "daemon", "--port", String(daemonPort)], {
    cwd: project, env, stdio: "ignore",
  })

  try {
    await waitForDaemon(env.SOURCEFED_DAEMON_URL)
    const commands = await piCommands(cli, project, env)
    for (const name of ["sourcefed", "sourcefed logs"]) {
      const command = commands.find((item) => item.name === name && item.source === "extension")
      assert.ok(command, name)
    }

    return { host: hostManifest.version, managedNpmInstall: true, commands: commands.map((c) => c.name) }
  } finally {
    await stopProcess(daemon)
  }
}

async function waitForDaemon(url) {
  const deadline = Date.now() + 10_000

  while (Date.now() < deadline) {
    const response = await fetch(url + "/rpc", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "daemon.sourceTypes" }), signal: AbortSignal.timeout(500),
    }).catch(() => undefined)
    if (response) { await response.text(); return }
    await sleep(50)
  }

  throw new Error("isolated daemon did not start")
}

async function piCommands(cli, cwd, env) {
  const process_ = spawn(process.execPath, [cli, "--mode", "rpc", "--no-session"], {
    cwd, env, stdio: ["pipe", "pipe", "pipe"],
  })
  let output = ""
  let errors = ""
  process_.stdout.on("data", (chunk) => { output = (output + chunk).slice(-128 * 1024) })
  process_.stderr.on("data", (chunk) => { errors = (errors + chunk).slice(-128 * 1024) })

  try {
    process_.stdin.write(JSON.stringify({ id: "commands", type: "get_commands" }) + "\n")
    const deadline = Date.now() + 30_000

    while (Date.now() < deadline) {
      const response = output.split("\n").filter(Boolean).map((line) => {
        try { return JSON.parse(line) } catch { return undefined }
      }).find((message) => message?.id === "commands" && message.type === "response")
      if (response) {
        assert.equal(response.success, true, JSON.stringify(response))
        return response.data.commands
      }
      if (process_.exitCode !== null) break
      await sleep(50)
    }

    throw new Error(`Pi RPC did not list extension commands: ${errors} ${output}`)
  } finally {
    await stopProcess(process_)
  }
}
