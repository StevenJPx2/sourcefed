#!/usr/bin/env node
import assert from "node:assert/strict"
import { copyFile, mkdtemp, readFile, readlink, realpath, rm, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { command, digest, environment } from "../e2e/harness.mjs"
import { assertPublishable } from "./artifact.mjs"
import { root, sourceState } from "./verify.mjs"

const tap = "stevenjpx2/sourcefed"
const formulaName = tap + "/sourcefed"

export function homebrewOptions(args) {
  assert.deepEqual(args, ["--confirm-real-homebrew"], "requires explicit --confirm-real-homebrew; dry runs never invoke Homebrew")
}

export function candidateFormula(source, version, sha256) {
  assert.match(source, /class Sourcefed < Formula/)
  assert.match(source, /url "https:\/\/registry.npmjs.org\/@fdcn\/sourcefed\/-\/sourcefed-[\d.]+\.tgz"/)
  assert.match(source, /sha256 "[a-f0-9]{64}"/)
  return source.replace(/sourcefed-[\d.]+\.tgz/g, "sourcefed-" + version + ".tgz")
    .replace(/sha256 "[a-f0-9]{64}"/, 'sha256 "' + sha256 + '"')
}

export function otherFormulae(inventory) {
  return inventory.split("\n").filter((line) => line && !/^sourcefed\s/.test(line)).join("\n")
}

// Homebrew loads formulae only from taps, so the candidate formula temporarily
// replaces the installed tap's local file; its original bytes are always restored.
export async function verifyHomebrew(record, args) {
  homebrewOptions(args)
  assert.equal(record.registryVerified, true, "registry verification must pass first")
  const work = await mkdtemp(path.join(os.tmpdir(), "sourcefed-brew-"))
  const output = []
  const brew = await brewRunner(work, output)
  try {
    await assertPublishable(record, await sourceState(await environment(path.join(work, "source"))), record.version)
    const prefix = await brew.run(["--prefix"])
    const formula = path.join(await brew.run(["--repository", tap]), "Formula/sourcefed.rb")
    const original = await readFile(formula, "utf8")
    const before = await snapshot(brew, prefix, formula)
    const previous = installedVersion(before)
    assert.notEqual(previous, record.version, "candidate version is already installed")
    await assertNoDependencyUpgrades(brew)
    const candidate = path.join(root, ".release/homebrew-formula.rb")
    await writeFile(candidate, candidateFormula(original, record.version, record.sha256))
    const failure = await upgradeCandidate(brew, formula, original, candidate, record, prefix, work)
    assert.equal((await snapshot(brew, prefix, formula)).tap, "", "tap checkout was not restored")
    if (failure) {
      await rollback(brew, prefix, previous, record.version)
      assert.deepEqual(await snapshot(brew, prefix, formula), before, "Homebrew rollback did not restore prior state")
      throw failure
    }
    const after = await snapshot(brew, prefix, formula)
    assert.equal(otherFormulae(after.inventory), otherFormulae(before.inventory), "a formula other than sourcefed changed")
    assert.equal(after.opt, "../Cellar/sourcefed/" + record.version)
    assert.equal(after.bin, "../Cellar/sourcefed/" + record.version + "/bin/sourcefed")
    await recordPass(record, brew, candidate, previous, after)
  } finally {
    await writeFile(path.join(root, ".release/homebrew.log"), output.join("\n"))
    await rm(work, { recursive: true, force: true })
  }
}

async function brewRunner(work, output) {
  // Homebrew needs the operator's HOME for tap trust; HOMEBREW_* controls stop
  // auto-update, cleanup, autoremove and dependent upgrades.
  const env = { PATH: process.env.PATH, HOME: os.homedir(),
    ...(process.env.XDG_CONFIG_HOME ? { XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME } : {}),
    OPENCODE_DB: path.join(work, "unused.sqlite"), HOMEBREW_NO_AUTO_UPDATE: "1",
    HOMEBREW_NO_INSTALL_UPGRADE: "1", HOMEBREW_NO_INSTALL_CLEANUP: "1",
    HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK: "1", HOMEBREW_NO_AUTOREMOVE: "1", HOMEBREW_NO_ENV_HINTS: "1" }
  const run = async (args, file = "brew") => {
    try {
      const result = await command(file, args, { cwd: work, env, timeout: 300_000 })
      output.push("$ " + file + " " + args.join(" ") + "\n" + result.stdout + result.stderr)
      return result.stdout.trim()
    } catch (error) {
      output.push("$ " + file + " " + args.join(" ") + "\n" + String(error))
      throw error
    }
  }
  return { run, output }
}

async function snapshot(brew, prefix, formula) {
  const link = (name) => readlink(path.join(prefix, name)).catch(() => "")
  return { inventory: await brew.run(["list", "--formula", "--versions"]),
    opt: await link("opt/sourcefed"), bin: await link("bin/sourcefed"),
    tap: await brew.run(["-C", path.dirname(path.dirname(formula)), "status", "--porcelain"], "git") }
}

function installedVersion(state) {
  const line = state.inventory.split("\n").find((entry) => /^sourcefed\s/.test(entry))
  assert.ok(line, "sourcefed must already be installed from " + tap)
  const versions = line.split(/\s+/).slice(1)
  assert.equal(versions.length, 1, "exactly one sourcefed keg must be installed")
  assert.equal(state.tap, "", "local tap checkout has changes")
  assert.equal(state.opt, "../Cellar/sourcefed/" + versions[0])
  assert.equal(state.bin, "../Cellar/sourcefed/" + versions[0] + "/bin/sourcefed")
  return versions[0]
}

async function assertNoDependencyUpgrades(brew) {
  const dependencies = (await brew.run(["deps", "--formula", formulaName])).split("\n").filter(Boolean)
  const outdated = new Set((await brew.run(["outdated", "--formula", "--quiet"])).split("\n").filter(Boolean))
  const blocked = dependencies.filter((name) => outdated.has(name) || outdated.has(path.basename(name)))
  assert.deepEqual(blocked, [], "outdated sourcefed dependencies; update them separately first")
}

async function upgradeCandidate(brew, formula, original, candidate, record, prefix, work) {
  try {
    await copyFile(candidate, formula)
    const plan = await brew.run(["upgrade", "--formula", "--dry-run", "--no-ask", formulaName])
    for (const name of (await brew.run(["deps", "--formula", formulaName])).split("\n").filter(Boolean)) {
      assert.ok(!new RegExp("\\b" + path.basename(name) + "\\b").test(plan), "upgrade would change " + name)
    }
    await brew.run(["upgrade", "--formula", "--no-ask", formulaName])
    await brew.run(["test", formulaName])
    await installedChecks(prefix, record, work, brew.output)
  } catch (error) {
    return error
  } finally {
    await writeFile(formula, original)
  }
}

async function installedChecks(prefix, record, work, output) {
  const entry = await realpath(path.join(prefix, "Cellar/sourcefed", record.version, "libexec/bin/sourcefed"))
  const manifest = path.join(path.dirname(path.dirname(entry)), "package.json")
  assert.equal(JSON.parse(await readFile(manifest, "utf8")).version, record.version)
  // CLI checks use a fresh profile, never the operator's Sourcefed state.
  const env = await environment(path.join(work, "cli"))
  const bin = path.join(prefix, "opt/sourcefed/bin/sourcefed")
  const result = await command(bin, ["skills", "list"], { cwd: work, env, timeout: 30_000 })
  output.push("$ sourcefed skills list\n" + result.stdout)
  assert.match(result.stdout, /core/)
}

async function rollback(brew, prefix, previous, version) {
  const opt = await readlink(path.join(prefix, "opt/sourcefed")).catch(() => "")
  if (existsSync(path.join(prefix, "Cellar/sourcefed", version))) {
    // Without --force, uninstall removes only the opt-linked keg.
    assert.equal(opt, "../Cellar/sourcefed/" + version, "unexpected opt link; restore Homebrew manually from the log")
    await brew.run(["uninstall", "--formula", "sourcefed"])
  }
  const linked = await readlink(path.join(prefix, "opt/sourcefed")).catch(() => "")
  if (linked !== "../Cellar/sourcefed/" + previous) await brew.run(["link", "--formula", "sourcefed"])
}

async function recordPass(record, brew, candidate, previous, after) {
  record.homebrewVerified = true
  record.results = record.results.filter((gate) => gate.name !== "homebrew")
  record.results.push({ name: "homebrew", phase: "postpublish", status: "pass", detail: {
    integrity: record.integrity, sha256: record.sha256, formula: candidate, formulaSha256: await digest(candidate),
    hostVersion: await brew.run(["--version"]), previous, installed: after.inventory.split("\n").find((l) => l.startsWith("sourcefed ")),
    log: path.join(root, ".release/homebrew.log"),
  } })
  await writeFile(path.join(root, ".release/manifest.json"), JSON.stringify(record, null, 2) + "\n")
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const record = JSON.parse(await readFile(path.join(root, ".release/manifest.json"), "utf8"))
  await verifyHomebrew(record, process.argv.slice(2))
}
