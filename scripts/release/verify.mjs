#!/usr/bin/env node
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { Blocked, command, digest, environment } from "../e2e/harness.mjs"
import { packageGate } from "../e2e/package.mjs"
import { prepareTools } from "../e2e/scenarios.mjs"
import { typesGate } from "../e2e/types.mjs"
import { cliDaemonGate } from "../e2e/cli-daemon.mjs"
import { mcpHttpGate, mcpStdioGate } from "../e2e/mcp.mjs"
import { providerPollGate } from "../e2e/providers.mjs"
import { opencodeGate, tuiGate, visualGate } from "../e2e/opencode.mjs"
import { piGate } from "../e2e/pi.mjs"
import { registryGate } from "../e2e/registry-canary.mjs"

export const root = fileURLToPath(new URL("../../", import.meta.url))

export function options(args) {
  const result = {}
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, "")
    assert.ok(["dry-run", "artifact", "tui-proof", "registry-proof", "termctrl"].includes(key), `unknown option ${args[i]}`)
    result[key] = key === "dry-run" ? true : args[++i]
    assert.ok(result[key], `missing --${key} value`)
  }
  return result
}

export async function sourceState(env) {
  const git = async (args) => (await command("git", args, { cwd: root, env })).stdout
  const commit = (await git(["rev-parse", "HEAD"])).trim()
  const status = await git(["status", "--porcelain"])
  const hash = createHash("sha256").update(await git(["diff", "--binary", "HEAD"]))
  for (const file of (await git(["ls-files", "--others", "--exclude-standard", "-z"])).split("\0").filter(Boolean).sort()) {
    hash.update(file).update(await readFile(path.join(root, file)))
  }
  return { commit, dirty: Boolean(status.trim()), sourceHash: hash.digest("hex") }
}

export async function verify(settings) {
  assert.ok(["darwin", "linux"].includes(process.platform), "release process-group isolation requires macOS or Linux")
  const work = await mkdtemp(path.join(os.tmpdir(), "sourcefed-release-"))
  const env = await environment(path.join(work, "isolation"))
  const source = await sourceState(env)
  const version = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).version
  const context = { root, work, env, version, ...source, options: settings, consumer: path.join(work, "consumer") }
  const record = { schema: 1, version, ...source, node: process.version, results: [], verified: false, at: new Date().toISOString() }
  try {
    if (!settings["dry-run"]) assert.equal(source.dirty, false, "release verification requires a clean checkout")
    await gate(record, "build", "prepublish", () => command("npm", ["run", "check"], { cwd: root, env, timeout: 180_000 }))
    await pack(context, settings.artifact)
    Object.assign(record, { artifact: context.artifact, sha256: context.sha256, integrity: context.integrity })
    for (const [name, run] of prepublishGates()) {
      await gate(record, name, "prepublish", () => run(context))
    }
    await gate(record, "registry", "postpublish", () => registryGate(context))
    record.results.push({ name: "homebrew", phase: "postpublish", status: "pending", reason: "post-publish; explicit opt-in required" })
    console.log("homebrew: PENDING — post-publish")
    const final = await sourceState(env)
    assert.deepEqual(final, source, "source changed during verification")
    record.verified = !source.dirty && record.results.filter((r) => r.phase === "prepublish").every((r) => r.status === "pass")
  } finally {
    await mkdir(path.join(root, ".release"), { recursive: true })
    await writeFile(path.join(root, ".release/manifest.json"), JSON.stringify(record, null, 2) + "\n")
    await rm(work, { recursive: true, force: true })
  }
  return record
}

function prepublishGates() {
  return [
    ["package", packageGate], ["tools", prepareTools], ["types", typesGate],
    ["cli-daemon", cliDaemonGate], ["mcp-http", mcpHttpGate], ["mcp-stdio", mcpStdioGate],
    ["provider-poll", providerPollGate], ["provider-webhooks", webhookGate],
    ["opencode-server", opencodeGate], ["opencode-tui", tuiGate], ["visual-review", visualGate], ["pi", piGate],
  ]
}

async function webhookGate(context) {
  const env = await environment(path.join(context.work, "webhooks"))
  const result = await command(process.execPath, [path.join(root, "scripts/e2e/webhooks.mjs"),
    context.packageDir, path.join(context.work, "webhook-state")], { cwd: context.consumer, env, timeout: 30_000 })
  return { output: result.stdout.trim() }
}

async function pack(context, artifact) {
  await mkdir(path.join(root, ".release"), { recursive: true })
  const directory = await mkdtemp(path.join(root, ".release/candidate-"))
  if (artifact) {
    context.artifact = path.resolve(artifact)
  } else {
    const packed = JSON.parse((await command("npm", ["pack", "--json", "--pack-destination", directory], {
      cwd: path.join(root, "packages/sourcefed"), env: context.env,
    })).stdout)
    assert.equal(packed.length, 1)
    context.artifact = path.join(directory, packed[0].filename)
  }
  context.sha256 = await digest(context.artifact)
  context.integrity = "sha512-" + createHash("sha512").update(await readFile(context.artifact)).digest("base64")
}

async function gate(record, name, phase, run) {
  const started = Date.now()
  try {
    let detail = await run()
    if (detail && typeof detail.stdout === "string") {
      const log = path.join(root, ".release", name + ".log")
      await writeFile(log, detail.stdout + "\n" + detail.stderr)
      detail = { log }
    }
    record.results.push({ name, phase, status: "pass", durationMs: Date.now() - started, detail })
    console.log(`${name}: PASS`)
  } catch (error) {
    const status = error instanceof Blocked ? "blocked" : "fail"
    const log = path.join(root, ".release", name + ".log")
    await writeFile(log, String(error))
    record.results.push({ name, phase, status, durationMs: Date.now() - started, error: String(error).split("\n")[0], log })
    console.log(`${name}: ${status.toUpperCase()} — ${String(error).slice(0, 500)}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await mkdir(path.join(root, ".release"), { recursive: true })
  const result = await verify(options(process.argv.slice(2)))
  console.log(JSON.stringify({ version: result.version, artifact: result.artifact, sha256: result.sha256, verified: result.verified }))
  if (result.results.some((r) => r.phase === "prepublish" && r.status !== "pass") || !result.verified) process.exitCode = 1
}
