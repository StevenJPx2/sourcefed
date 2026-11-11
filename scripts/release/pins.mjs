#!/usr/bin/env node
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = fileURLToPath(new URL("../../", import.meta.url))

export function selections(args) {
  const accepted = new Set(["--tap", "--dotfiles", "--pi", "--dry-run"])
  for (const arg of args) assert.ok(accepted.has(arg), `unknown pins option ${arg}`)
  const chosen = ["tap", "dotfiles", "pi"].filter((name) => args.includes("--" + name))
  assert.ok(chosen.length, "choose --tap, --dotfiles or --pi explicitly; default performs no operations")
  return { chosen, dryRun: args.includes("--dry-run") }
}

export function assertPinsAllowed(release, version, chosen) {
  assert.equal(release.version, version)
  assert.equal(release.registryVerified, true, "pin updates require the exact registry artifact to pass every canary")
  if (chosen.includes("tap")) {
    assert.equal(release.homebrewVerified, true, "tap update requires a passing post-publish Homebrew check")
    const matches = release.results.filter((gate) => gate.name === "homebrew" && gate.phase === "postpublish")
    assert.equal(matches.length, 1)
    assert.equal(matches[0].status, "pass")
    assert.equal(matches[0].detail.integrity, release.integrity)
    assert.equal(matches[0].detail.sha256, release.sha256)
  }
}

async function main() {
  const { chosen, dryRun } = selections(process.argv.slice(2))
  const version = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).version
  if (dryRun) {
    console.log(JSON.stringify({ planOnly: true, version, steps: chosen, prerequisite: chosen.includes("tap") ? "registry canary and post-publish Homebrew pass" : "successful registry canary manifest", mutations: false }))
    return
  }
  const release = JSON.parse(await readFile(path.join(root, ".release/manifest.json"), "utf8"))
  assertPinsAllowed(release, version, chosen)
  for (const name of chosen) await ({ tap, dotfiles, pi })[name](version, release)
}

async function tap(version, release) {
  const directory = process.env.TAP_DIR ?? path.join(os.homedir(), "Documents/Projects/taps")
  assert.equal(git(directory, ["status", "--porcelain"]).trim(), "", "tap checkout has user changes")
  const metadata = await fetch(`https://registry.npmjs.org/@fdcn%2fsourcefed/${version}`, { signal: AbortSignal.timeout(20000) })
  assert.equal(metadata.status, 200)
  const distribution = (await metadata.json()).dist
  assert.equal(distribution.integrity, release.integrity)
  const response = await fetch(distribution.tarball, { signal: AbortSignal.timeout(30000) })
  assert.equal(response.status, 200)
  const bytes = Buffer.from(await response.arrayBuffer())
  const sha = createHash("sha256").update(bytes).digest("hex")
  assert.equal(sha, release.sha256)
  mutate("git", ["pull", "--ff-only", "origin", "HEAD"], directory)
  const formula = path.join(directory, "Formula/sourcefed.rb")
  const source = await readFile(formula, "utf8")
  assert.ok(/sourcefed-[\d.]+\.tgz/.test(source) && /sha256 "[a-f0-9]{64}"/.test(source))
  await writeFile(formula, source.replace(/sourcefed-[\d.]+\.tgz/g, `sourcefed-${version}.tgz`).replace(/sha256 "[a-f0-9]{64}"/, `sha256 "${sha}"`))
  mutate("git", ["add", "--", "Formula/sourcefed.rb"], directory)
  mutate("git", ["commit", "-m", `sourcefed: update to ${version}`], directory)
  mutate("git", ["push", "origin", "HEAD"], directory)
}

async function dotfiles(version) {
  const directory = process.env.DOTFILES_DIR ?? path.join(os.homedir(), "Documents/Projects/dotfiles")
  assert.equal(git(directory, ["status", "--porcelain"]).trim(), "", "dotfiles checkout has user changes")
  const files = ["configs/opencode/opencode.jsonc", "configs/opencode/cli.json", "configs/opencode/tui.json"]
  const changed = []
  for (const file of files) {
    const full = path.join(directory, file)
    const source = await readFile(full, "utf8").catch((error) => { if (error.code === "ENOENT") return; throw error })
    if (source === undefined) continue
    const next = source.replace(/@fdcn\/sourcefed@[\d.]+/g, `@fdcn/sourcefed@${version}`)
    if (source === next) continue
    await writeFile(full, next)
    changed.push(file)
  }
  assert.ok(changed.length, "no matching dotfiles pins to update")
  mutate("git", ["add", "--", ...changed], directory)
  mutate("git", ["commit", "-m", `chore(opencode): bump sourcefed plugin to ${version}`], directory)
  mutate("git", ["push", "origin", "HEAD"], directory)
}

async function pi(version) {
  mutate("pi", ["install", `npm:@fdcn/sourcefed@${version}`], root)
}

function git(directory, args) {
  return execFileSync("git", args, { cwd: directory, encoding: "utf8", timeout: 30000 })
}

function mutate(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit", timeout: 180000 })
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main()
