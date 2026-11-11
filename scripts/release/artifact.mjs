import assert from "node:assert/strict"
import { digest } from "../e2e/harness.mjs"

// Edits only the top-level version so release syncs preserve manifest formatting.
export function withVersion(source, version) {
  const pattern = /^(  "version": ")[^"]*(",?)$/m
  assert.match(source, pattern, "manifest has no top-level version")
  return source.replace(pattern, `$1${version}$2`)
}

export async function assertPublishable(record, state, version) {
  assert.equal(record.schema, 1)
  assert.equal(record.verified, true, "required release gates have not passed")
  assert.equal(record.dirty, false)
  assert.equal(state.dirty, false, "working tree changed after verification")
  assert.equal(record.commit, state.commit, "commit changed after verification")
  assert.equal(record.sourceHash, state.sourceHash, "source changed after verification")
  assert.equal(record.version, version, "version changed after verification")
  assert.ok(record.results.every((gate) => gate.phase !== "prepublish" || gate.status === "pass"), "failed or skipped prepublish gate")
  const required = ["build", "package", "tools", "types", "cli-daemon", "mcp-http", "mcp-stdio",
    "provider-poll", "provider-webhooks", "opencode-server", "opencode-tui", "visual-review", "pi"]
  for (const name of required) {
    const matches = record.results.filter((gate) => gate.name === name && gate.phase === "prepublish")
    assert.equal(matches.length, 1, `missing or duplicate gate ${name}`)
    assert.equal(matches[0].status, "pass", name)
  }
  assert.equal(await digest(record.artifact), record.sha256, "tarball bytes changed after verification")
}
