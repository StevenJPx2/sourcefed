import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { gunzipSync } from "node:zlib"
import { mkdir, readFile } from "node:fs/promises"
import path from "node:path"

export class Blocked extends Error {}

export async function environment(directory, extra = {}) {
  const env = {
    PATH: process.env.PATH, CI: "true", TERM: "xterm-256color",
    HOME: path.join(directory, "home"), TMPDIR: directory,
    XDG_CONFIG_HOME: path.join(directory, "config"),
    XDG_DATA_HOME: path.join(directory, "data"),
    XDG_STATE_HOME: path.join(directory, "state"),
    XDG_CACHE_HOME: path.join(directory, "cache"),
    PI_CODING_AGENT_DIR: path.join(directory, "pi"),
    OPENCODE_DB: path.join(directory, "opencode.sqlite"),
    npm_config_cache: path.join(directory, "npm"),
    // Bounded retries absorb transient registry timeouts without unbounded waits.
    npm_config_ignore_scripts: "true", npm_config_fetch_timeout: "60000",
    npm_config_fetch_retries: "2",
    ...extra,
  }
  await Promise.all([directory, env.HOME, env.XDG_CONFIG_HOME, env.XDG_DATA_HOME,
    env.XDG_STATE_HOME, env.XDG_CACHE_HOME, env.PI_CODING_AGENT_DIR].map((p) => mkdir(p, { recursive: true })))
  return env
}

export function command(file, args, { cwd, env, timeout = 120_000, check = true } = {}) {
  assert.ok(env?.HOME && env?.OPENCODE_DB, "commands require an explicit isolated environment")
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, env, detached: true, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    let failure
    let escalation
    const terminate = (reason) => {
      failure ??= reason
      signalGroup(child, "SIGTERM")
      escalation ??= setTimeout(() => signalGroup(child, "SIGKILL"), 2_000)
    }
    const timer = setTimeout(() => terminate(new Error(`${file} exceeded ${timeout} ms`)), timeout)
    const capture = (target, chunk) => {
      if (target.length + chunk.length > 1024 * 1024) terminate(new Error(`${file} exceeded output limit`))
      return (target + chunk).slice(-1024 * 1024)
    }
    child.stdout.on("data", (chunk) => { stdout = capture(stdout, chunk) })
    child.stderr.on("data", (chunk) => { stderr = capture(stderr, chunk) })
    child.once("error", (error) => { failure = error })
    child.once("close", (code) => {
      clearTimeout(timer)
      clearTimeout(escalation)
      // Each command owns its process group, including daemons orphaned by a failed test.
      signalGroup(child, "SIGKILL")
      if (failure || (check && code !== 0)) {
        reject(new Error(`${file}: ${failure?.message ?? `exit ${code}`}\n${stderr}\n${stdout}`))
      } else {
        resolve({ stdout, stderr, code })
      }
    })
  })
}

function signalGroup(child, signal) {
  if (!child.pid) return
  try { process.kill(-child.pid, signal) } catch (error) {
    if (error.code !== "ESRCH") throw error
  }
}

export async function digest(file, algorithm = "sha256") {
  return createHash(algorithm).update(await readFile(file)).digest("hex")
}

/** The digest of a tarball's uncompressed tar, the same for any gzip of the same entries. */
export async function contentDigest(file) {
  return createHash("sha256").update(gunzipSync(await readFile(file))).digest("hex")
}

export async function evidence(context, file, gate, checks) {
  if (!file) throw new Blocked(`${gate} needs an explicit artifact-bound operator evidence file`)
  const record = JSON.parse(await readFile(file, "utf8"))
  assert.equal(record.gate, gate)
  assert.equal(record.sha256, context.sha256, "evidence must describe this exact tarball")
  assert.equal(record.integrity, context.integrity)
  assert.equal(record.commit, context.commit)
  assert.equal(record.version, context.version)
  assert.equal(record.humanReviewed, true)
  assert.equal(record.isolated, true)
  assert.equal(record.cleanedUp, true)
  assert.ok(record.hostVersion && record.operator && record.at)
  assert.ok(Math.abs(Date.now() - Date.parse(record.at)) < 24 * 60 * 60 * 1000, "evidence expires after 24 hours")
  for (const name of checks) assert.equal(record.checks?.[name], true, name)
  assert.ok(Array.isArray(record.files) && record.files.length > 0, "attach rendered captures and command logs")
  for (const attachment of record.files) {
    const target = path.resolve(path.dirname(file), attachment.path)
    assert.equal(await digest(target), attachment.sha256, `evidence attachment ${attachment.path}`)
  }
  return { operator: record.operator, hostVersion: record.hostVersion, evidence: path.resolve(file) }
}
