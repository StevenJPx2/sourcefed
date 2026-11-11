#!/usr/bin/env node
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { environment } from "../e2e/harness.mjs"
import { options, root, sourceState, verify } from "./verify.mjs"
import { assertPublishable } from "./artifact.mjs"
import { verifyRegistry } from "./registry.mjs"

const args = process.argv.slice(2)
const otpIndex = args.indexOf("--otp")
const otp = otpIndex < 0 ? undefined : args.splice(otpIndex, 2)[1]
const settings = options(args)

if (settings["dry-run"]) {
  const report = await verify(settings)
  console.log("dry run: no sync commit, push, publication or pin update")
  if (!report.verified) process.exitCode = 1
} else {
  await publish()
}

async function publish() {
  assert.equal(git(["status", "--porcelain"]).trim(), "", "release requires a clean checkout")
  assert.equal(git(["branch", "--show-current"]).trim(), "main")
  const version = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).version
  assert.ok(/^\d+\.\d+\.\d+$/.test(version))
  const isolated = await environment(path.join(root, ".release/publish-preflight"))
  // Registry lookup failures are errors, never evidence that a version is unused.
  const versions = JSON.parse(execFileSync("npm", ["view", "@fdcn/sourcefed", "versions", "--json"], {
    env: isolated, encoding: "utf8", timeout: 30000,
  }))
  assert.ok(!versions.includes(version), `${version} is already published; run npm run release first`)
  await sync(version)
  const record = await verify(settings)
  await assertPublishable(record, await sourceState(isolated), version)
  mutate("git", ["push", "origin", "main"])
  await assertPublishable(record, await sourceState(isolated), version)
  // Only this mutation uses the operator's npm authentication and interactive 2FA.
  mutate("npm", ["publish", record.artifact, "--access", "public", ...(otp ? ["--otp", otp] : [])])
  try {
    await verifyRegistry(record, settings)
  } catch (error) {
    console.error(`Published ${version}, but registry canary is INCOMPLETE. No pins updated. ${error}`)
    console.error("Resume with npm run release:registry -- --registry-proof <file> after reviewing the failure.")
    throw error
  }
  console.log(`released @fdcn/sourcefed@${version} ${record.integrity}; pins remain opt-in`)
}

async function sync(version) {
  const manifest = path.join(root, "packages/sourcefed/package.json")
  const value = JSON.parse(await readFile(manifest, "utf8"))
  await writeFile(manifest, JSON.stringify({ ...value, version }, null, 2) + "\n")
  for (const name of ["README.md", "packages/sourcefed/README.md"]) {
    const file = path.join(root, name)
    await writeFile(file, (await readFile(file, "utf8")).replace(/@fdcn\/sourcefed@[\d.]+/g, `@fdcn/sourcefed@${version}`))
  }
  const env = await environment(path.join(root, ".release/sync"))
  execFileSync("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit"], { cwd: root, env, timeout: 120000 })
  const changed = git(["status", "--porcelain"]).trim()
  if (!changed) return
  const files = ["packages/sourcefed/package.json", "package-lock.json", "README.md", "packages/sourcefed/README.md"]
  for (const line of changed.split("\n")) assert.ok(files.includes(line.trim().slice(2).trim()), `unexpected release sync change: ${line}`)
  mutate("git", ["add", "--", ...files])
  mutate("git", ["commit", "-m", `chore: sync @fdcn/sourcefed to ${version}`])
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 30000 })
}

function mutate(command, args) {
  // Authenticated publication/push is deliberately outside the scrubbed test environment.
  execFileSync(command, args, { cwd: root, stdio: "inherit", timeout: 180000 })
}
