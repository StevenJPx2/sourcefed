import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { assertPublishable } from "./artifact.mjs"
import { assertPinsAllowed, selections } from "./pins.mjs"
import { candidateFormula, homebrewOptions, otherFormulae } from "./homebrew.mjs"
import { Blocked, command, digest, environment, evidence } from "../e2e/harness.mjs"
import { classifyDiagnostics, parseDiagnostics } from "../e2e/types.mjs"

test("pins have no implicit live actions and tap selection excludes other operations", () => {
  assert.throws(() => selections([]), /choose/)
  assert.deepEqual(selections(["--tap", "--dry-run"]), { chosen: ["tap"], dryRun: true })
  assert.throws(() => selections(["--all"]), /unknown/)
})

test("tap publication requires artifact-bound post-publish Homebrew proof", () => {
  const release = { version: "0.4.0", registryVerified: true, integrity: "integrity", sha256: "sha", results: [] }
  assertPinsAllowed(release, "0.4.0", ["pi"])
  assert.throws(() => assertPinsAllowed(release, "0.4.0", ["tap"]))
  release.homebrewVerified = true
  assert.throws(() => assertPinsAllowed(release, "0.4.0", ["tap"]))
  const gate = { name: "homebrew", phase: "postpublish", status: "pending", detail: { integrity: "integrity", sha256: "sha" } }
  release.results.push(gate)
  assert.throws(() => assertPinsAllowed(release, "0.4.0", ["tap"]))
  gate.status = "pass"
  assertPinsAllowed(release, "0.4.0", ["tap"])
  gate.detail.sha256 = "wrong"
  assert.throws(() => assertPinsAllowed(release, "0.4.0", ["tap"]))
})

test("Homebrew requires explicit consent and prepares only a local formula", () => {
  for (const args of [[], ["--dry-run"], ["--confirm-real-homebrew", "--dry-run"]]) assert.throws(() => homebrewOptions(args))
  homebrewOptions(["--confirm-real-homebrew"])
  const source = 'class Sourcefed < Formula\nurl "https://registry.npmjs.org/@fdcn/sourcefed/-/sourcefed-0.3.8.tgz"\nsha256 "' + "a".repeat(64) + '"\nend'
  const result = candidateFormula(source, "0.4.0", "b".repeat(64))
  assert.match(result, /sourcefed-0\.4\.0\.tgz/)
  assert.ok(result.includes("b".repeat(64)))
  assert.throws(() => candidateFormula("unexpected formula", "0.4.0", "b".repeat(64)))
  assert.equal(otherFormulae("node 26.13.0_2\nsourcefed 0.3.8\ngit 2.50.0"), "node 26.13.0_2\ngit 2.50.0")
  assert.notEqual(otherFormulae("node 26.13.0_2\nsourcefed 0.4.0 0.3.8"), otherFormulae("node 26.14.0\nsourcefed 0.3.8"))
})

test("host type gate accepts only pinned upstream diagnostics", () => {
  const known = [
    "node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/providers/openai.models.d.ts(1,20): error TS1543: Importing a JSON file requires a 'type: \"json\"' import attribute.",
    "node_modules/@earendil-works/pi-coding-agent/node_modules/@anthropic-ai/sdk/internal/types.d.mts(48,181): error TS2307: Cannot find module '../../../node_modules/undici-types/index.d.ts' or its corresponding type declarations.",
    "node_modules/@earendil-works/pi-coding-agent/node_modules/@google/genai/dist/node/node.d.ts(3,29): error TS2307: Cannot find module '@modelcontextprotocol/sdk/client/index.js' or its corresponding type declarations.",
    "node_modules/@opentui/core/lib/KeyHandler.d.ts(57,5): error TS2416: Property 'emit' in type 'InternalKeyHandler' is not assignable to the same property in base type 'KeyHandler'.",
    "  Type 'A' is not assignable to type 'B'.",
  ].join("\n")
  const accepted = classifyDiagnostics(parseDiagnostics(known))
  assert.deepEqual(accepted.unexpected, [])
  assert.equal(Object.keys(accepted.accepted).length, 4)
  for (const line of [
    "node_modules/@fdcn/sourcefed/dist.dts/adapters/pi/src/index.d.ts(1,35): error TS2307: Cannot find module 'x'.",
    "contract.ts(10,1): error TS2578: Unused '@ts-expect-error' directive.",
    "node_modules/@opentui/core/lib/KeyHandler.d.ts(60,5): error TS2416: Property 'on' in type 'InternalKeyHandler' is not assignable.",
    "node_modules/@google/genai/dist/node/node.d.ts(3,29): error TS2307: Cannot find module 'other'.",
    "node_modules/@earendil-works/pi-ai/dist/providers/openai.models.d.ts(1,20): error TS2322: Type mismatch.",
    "error TS5083: Cannot read file 'tsconfig.json'.",
  ]) {
    assert.equal(classifyDiagnostics(parseDiagnostics(line)).unexpected.length, 1, line)
  }
})

test("isolated environments exclude inherited provider credentials and caller config", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sourcefed-env-proof-"))
  const previous = process.env.GITHUB_TOKEN
  process.env.GITHUB_TOKEN = "must-not-leak"
  try {
    const env = await environment(directory)
    assert.equal(env.GITHUB_TOKEN, undefined)
    assert.equal(env.HOME, path.join(directory, "home"))
    assert.equal(env.OPENCODE_DB, path.join(directory, "opencode.sqlite"))
    assert.notEqual(env.HOME, process.env.HOME)
  } finally {
    if (previous === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = previous
    await rm(directory, { recursive: true, force: true })
  }
})

test("missing external evidence fails closed", async () => {
  await assert.rejects(evidence({}, undefined, "homebrew", []), Blocked)
})

test("publication rejects missing, failed, skipped, stale or modified proof", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sourcefed-artifact-proof-"))
  try {
    const artifact = path.join(directory, "candidate.tgz")
    await writeFile(artifact, "candidate bytes")
    const state = { commit: "commit", sourceHash: "source", dirty: false }
    const names = ["build", "package", "tools", "types", "cli-daemon", "mcp-http", "mcp-stdio",
      "provider-poll", "provider-webhooks", "opencode-server", "opencode-tui", "visual-review", "pi"]
    const record = { schema: 1, verified: true, ...state, version: "0.4.0", artifact,
      sha256: await digest(artifact), results: names.map((name) => ({ name, phase: "prepublish", status: "pass" })) }
    await assertPublishable(record, state, "0.4.0")
    await assert.rejects(assertPublishable({ ...record, verified: false }, state, "0.4.0"))
    await assert.rejects(assertPublishable({ ...record, results: record.results.slice(1) }, state, "0.4.0"))
    for (const status of ["skip", "blocked", "fail"]) {
      await assert.rejects(assertPublishable({ ...record, results: record.results.map((gate) => gate.name === "types" ? { ...gate, status } : gate) }, state, "0.4.0"))
    }
    await assert.rejects(assertPublishable(record, { ...state, dirty: true }, "0.4.0"))
    await assert.rejects(assertPublishable(record, { ...state, commit: "other" }, "0.4.0"))
    await assert.rejects(assertPublishable(record, { ...state, sourceHash: "other" }, "0.4.0"))
    await assert.rejects(assertPublishable(record, state, "0.4.1"))
    await writeFile(artifact, "changed bytes")
    await assert.rejects(assertPublishable(record, state, "0.4.0"), /bytes changed/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("bounded commands terminate their owned process group", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sourcefed-deadline-proof-"))
  try {
    const env = await environment(directory)
    await assert.rejects(command(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { cwd: directory, env, timeout: 50 }), /exceeded/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
