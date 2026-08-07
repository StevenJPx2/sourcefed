#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const otpIndex = process.argv.indexOf("--otp")
const OTP = otpIndex >= 0 ? process.argv[otpIndex + 1] : undefined

// The version comes from the root package.json, bumped by `npm run release` (changelogen).
const VERSION = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version
if (!/^\d+\.\d+\.\d+$/.test(VERSION)) {
  console.error("no valid version in root package.json — run `npm run release` first")
  process.exit(1)
}

const AGG_PKG = path.join(ROOT, "packages/sourcefed/package.json")
const READMES = [path.join(ROOT, "README.md"), path.join(ROOT, "packages/sourcefed/README.md")]
const REL = path.join(ROOT, ".release")
const TARBALL = path.join(REL, `fdcn-sourcefed-${VERSION}.tgz`)

// 1. working tree and branch
const status = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim()
if (status) fail(`working tree is not clean:\n${status}`)
const branch = execFileSync("git", ["branch", "--show-current"], { cwd: ROOT, encoding: "utf8" }).trim()
if (branch !== "main") fail(`release from main, not ${branch}`)

// 2. sync the aggregate manifest and README pins to the released version
const manifest = JSON.parse(readFileSync(AGG_PKG, "utf8"))
if (manifest.version === VERSION) fail(`@fdcn/sourcefed ${VERSION} is already published — bump with \`npm run release\` first`)
writeFileSync(AGG_PKG, JSON.stringify({ ...manifest, version: VERSION }, null, 2) + "\n")
for (const readme of READMES) {
  writeFileSync(readme, readFileSync(readme, "utf8").replace(/@fdcn\/sourcefed@[\d.]+/g, `@fdcn/sourcefed@${VERSION}`))
}

// 3. gates
run("npm", ["run", "check"], ROOT)
run("npm", ["run", "integration"], ROOT)

// 4. pack the exact artifact
rmSync(REL, { recursive: true, force: true })
mkdirSync(REL, { recursive: true })
run("npm", ["pack", "--pack-destination", REL], path.join(ROOT, "packages/sourcefed"))
const sha = createHash("sha256").update(readFileSync(TARBALL)).digest("hex")

// 5. aggregate-only canary
const consumer = mkdtempSync(path.join(os.tmpdir(), "sf-release-"))
writeFileSync(path.join(consumer, "package.json"), JSON.stringify({ name: "sf-canary", version: "0.0.0", private: true, type: "module" }))
run("npm", ["install", "--no-audit", "--no-fund", TARBALL], consumer)
const skills = execFileSync("./node_modules/.bin/sourcefed", ["skills", "list"], { cwd: consumer, encoding: "utf8" })
if (!skills.includes("core:")) fail("canary: skills list failed")
if (existsSync(path.join(consumer, "node_modules/@sourcefed"))) fail("canary: private @sourcefed packages leaked into the consumer")
rmSync(consumer, { recursive: true, force: true })

// 6. commit + push the sync
run("git", ["add", "packages/sourcefed/package.json", ...READMES], ROOT)
run("git", ["commit", "-m", `chore: sync @fdcn/sourcefed to ${VERSION}`], ROOT)
run("git", ["push", "origin", "main"], ROOT)

// 7. publish the exact tarball (OTP prompts on the terminal unless --otp is given)
run("npm", ["publish", TARBALL, "--access", "public", ...(OTP ? ["--otp", OTP] : [])], ROOT)

// 8. registry canary
waitForRegistry(VERSION)
const canary = mkdtempSync(path.join(os.tmpdir(), "sf-registry-"))
writeFileSync(path.join(canary, "package.json"), JSON.stringify({ name: "sf-registry-canary", version: "0.0.0", private: true, type: "module" }))
run("npm", ["install", "--no-audit", "--no-fund", `@fdcn/sourcefed@${VERSION}`], canary)
execFileSync("./node_modules/.bin/sourcefed", ["skills", "list"], { cwd: canary, encoding: "utf8" })
rmSync(canary, { recursive: true, force: true })

writeManifest(VERSION, sha)
console.log(`\nreleased @fdcn/sourcefed@${VERSION} (${sha.slice(0, 12)})\n  tarball: ${TARBALL}\n  GitHub release: created from the v${VERSION} tag by the Release workflow`)
console.log("  deployment pins: `npm run release:pins`")

function writeManifest(version, sha256) {
  const record = {
    version,
    tarball: TARBALL,
    sha256,
    commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(),
    node: process.version,
    at: new Date().toISOString(),
  }
  writeFileSync(path.join(REL, "manifest.json"), JSON.stringify(record, null, 2) + "\n")
}

function waitForRegistry(version) {
  const deadline = Date.now() + 5 * 60_000
  while (Date.now() < deadline) {
    const latest = execFileSync("npm", ["view", "@fdcn/sourcefed", "dist-tags.latest"], { encoding: "utf8" }).trim()
    if (latest === version) return
    console.log(`[release] waiting for the registry to serve ${version} (currently ${latest})...`)
    execFileSync("sleep", ["15"])
  }
  fail(`registry never served ${version}`)
}

function run(command, args, cwd) {
  console.log(`$ ${command} ${args.join(" ")}`)
  execFileSync(command, args, { cwd, stdio: "inherit" })
}

function fail(message) {
  console.error(`\n[release] ${message}`)
  process.exit(1)
}
