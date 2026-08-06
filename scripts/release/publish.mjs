#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const VERSION = process.argv[2]
const otpIndex = process.argv.indexOf("--otp")
const OTP = otpIndex >= 0 ? process.argv[otpIndex + 1] : undefined

if (!/^\d+\.\d+\.\d+$/.test(VERSION ?? "")) {
  console.error("usage: npm run release -- <version> [--otp CODE]")
  process.exit(1)
}

const PKG_PATH = path.join(ROOT, "packages/sourcefed/package.json")
const READMES = [path.join(ROOT, "README.md"), path.join(ROOT, "packages/sourcefed/README.md")]
const REL = path.join(ROOT, ".release")
const TARBALL = path.join(REL, `fdcn-sourcefed-${VERSION}.tgz`)
const DOTFILES = process.env.DOTFILES_DIR ?? path.join(os.homedir(), "Documents/Projects/dotfiles")
const TAP = process.env.TAP_DIR ?? path.join(os.homedir(), "Documents/Projects/homebrew-sourcefed")

// 1. working tree and branch
const status = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim()
if (status) fail(`working tree is not clean:\n${status}`)
const branch = execFileSync("git", ["branch", "--show-current"], { cwd: ROOT, encoding: "utf8" }).trim()
if (branch !== "main") fail(`release from main, not ${branch}`)

// 2. version bump
const manifest = JSON.parse(readFileSync(PKG_PATH, "utf8"))
if (manifest.version === VERSION) fail(`version ${VERSION} is already set — pick a new version`)
writeFileSync(PKG_PATH, JSON.stringify({ ...manifest, version: VERSION }, null, 2) + "\n")
for (const readme of READMES) {
  writeFileSync(readme, readFileSync(readme, "utf8").replace(/@fdcn\/sourcefed@[\d.]+/g, `@fdcn/sourcefed@${VERSION}`))
}

// 3. gates
run("npm", ["run", "check"], ROOT)
run("npm", ["run", "integration"], ROOT)

// 4. pack the exact artifact
rmSync(REL, { recursive: true, force: true })
mkdirSync(REL, { recursive: true })
run("npm", ["pack", "packages/sourcefed", "--pack-destination", REL], ROOT)
const sha = createHash("sha256").update(readFileSync(TARBALL)).digest("hex")

// 5. aggregate-only canary
const consumer = mkdtempSync(path.join(os.tmpdir(), "sf-release-"))
writeFileSync(path.join(consumer, "package.json"), JSON.stringify({ name: "sf-canary", version: "0.0.0", private: true, type: "module" }))
run("npm", ["install", "--no-audit", "--no-fund", TARBALL], consumer)
const skills = execFileSync("./node_modules/.bin/sourcefed", ["skills", "list"], { cwd: consumer, encoding: "utf8" })
if (!skills.includes("core:")) fail("canary: skills list failed")
if (existsSync(path.join(consumer, "node_modules/@sourcefed"))) fail("canary: private @sourcefed packages leaked into the consumer")
rmSync(consumer, { recursive: true, force: true })

// 6. commit + push the bump
run("git", ["add", "packages/sourcefed/package.json", ...READMES], ROOT)
run("git", ["commit", "-m", `chore: bump @fdcn/sourcefed to ${VERSION}`], ROOT)
run("git", ["push", "origin", "main"], ROOT)

// 7. publish the exact tarball (OTP prompts on the terminal unless --otp is given)
run("npm", ["publish", TARBALL, "--access", "public", ...(OTP ? ["--otp", OTP] : [])], ROOT, { interactive: true })

// 8. registry canary
waitForRegistry(VERSION)
const canary = mkdtempSync(path.join(os.tmpdir(), "sf-registry-"))
writeFileSync(path.join(canary, "package.json"), JSON.stringify({ name: "sf-registry-canary", version: "0.0.0", private: true, type: "module" }))
run("npm", ["install", "--no-audit", "--no-fund", `@fdcn/sourcefed@${VERSION}`], canary)
execFileSync("./node_modules/.bin/sourcefed", ["skills", "list"], { cwd: canary, encoding: "utf8" })
rmSync(canary, { recursive: true, force: true })

// 9. pins: dotfiles, pi, homebrew tap
updateDotfiles(VERSION)
run("pi", ["install", `npm:@fdcn/sourcefed@${VERSION}`], ROOT, { optional: true })
updateTap(VERSION, sha)

// 10. tag — the Release workflow creates the GitHub release from this tag
run("git", ["tag", `v${VERSION}`], ROOT)
run("git", ["push", "origin", `v${VERSION}`], ROOT)

console.log(`\nreleased @fdcn/sourcefed@${VERSION} (${sha.slice(0, 12)})\n  tarball: ${TARBALL}\n  pins: dotfiles, pi, homebrew tap updated\n  GitHub release: created by the v${VERSION} tag workflow`)
console.log(`  record: ${writeManifest(VERSION, sha)}`)

function writeManifest(version, sha256) {
  const manifest = {
    version,
    tarball: TARBALL,
    sha256,
    commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(),
    node: process.version,
    at: new Date().toISOString(),
  }
  writeFileSync(path.join(REL, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")
  return path.join(REL, "manifest.json")
}

function waitForRegistry(version) {
  const deadline = Date.now() + 5 * 60_000
  while (Date.now() < deadline) {
    const latest = execFileSync("npm", ["view", "@fdcn/sourcefed", "dist-tags.latest"], { encoding: "utf8" }).trim()
    if (latest === version) return
    console.log(`[release] waiting for registry to serve ${version} (currently ${latest})...`)
    execFileSync("sleep", ["15"])
  }
  fail(`registry never served ${version}`)
}

function updateDotfiles(version) {
  if (!existsSync(path.join(DOTFILES, "configs/opencode/opencode.jsonc"))) {
    console.warn(`[release] dotfiles repo not found at ${DOTFILES}; skip pin update`)
    return
  }
  for (const file of ["configs/opencode/opencode.jsonc", "configs/opencode/tui.json"]) {
    const full = path.join(DOTFILES, file)
    writeFileSync(full, readFileSync(full, "utf8").replace(/@fdcn\/sourcefed@[\d.]+/g, `@fdcn/sourcefed@${version}`))
  }
  run("git", ["add", "configs/opencode"], DOTFILES)
  run("git", ["commit", "-m", `chore(opencode): bump sourcefed plugin to ${version}`], DOTFILES)
  run("git", ["push", "origin", "HEAD"], DOTFILES)
}

function updateTap(version, sha256) {
  const formula = path.join(TAP, "Formula/sourcefed.rb")
  if (!existsSync(TAP)) {
    console.warn(`[release] tap repo not found at ${TAP}; skip formula update`)
    return
  }
  run("git", ["pull", "--rebase", "-q", "origin", "HEAD"], TAP)
  let source = readFileSync(formula, "utf8")
    .replace(/sourcefed-[\d.]+\.tgz/g, `sourcefed-${version}.tgz`)
    .replace(/sha256 "[a-f0-9]{64}"/, `sha256 "${sha256}"`)
  writeFileSync(formula, source)
  run("git", ["add", "Formula"], TAP)
  run("git", ["commit", "-m", `sourcefed: update to ${version}`], TAP)
  run("git", ["push", "origin", "HEAD"], TAP)
}

function run(command, args, cwd, options = {}) {
  console.log(`$ ${command} ${args.join(" ")}`)
  try {
    execFileSync(command, args, { cwd, stdio: options.interactive ? "inherit" : "inherit" })
  } catch (error) {
    if (options.optional) return
    throw error
  }
}

function fail(message) {
  console.error(`\n[release] ${message}`)
  process.exit(1)
}
