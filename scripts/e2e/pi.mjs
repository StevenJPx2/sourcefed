import assert from "node:assert/strict"
import path from "node:path"
import { command, environment } from "./harness.mjs"

export async function piGate(context, registry = false) {
  const env = await environment(path.join(context.work, registry ? "registry-hosts" : "pi-hosts"))
  const args = [path.join(context.root, "scripts/check-optional-pi.mjs"), "--installed", context.packageDir]
  args.push(...(registry ? ["--registry"] : ["--tarball", context.artifact]))
  const result = await command(process.execPath, args, { cwd: context.consumer, env, timeout: 180_000 })
  const report = JSON.parse(result.stdout)
  assert.equal(report.plainInstallHasPi, false)
  assert.equal(report.opencode.installedPluginLoaded, true)
  assert.equal(report.pi.managedNpmInstall, true)
  const approved = new Set([
    "https://github.com/advisories/GHSA-3g3m-2fjr-6pw4",
    "https://github.com/advisories/GHSA-g3hv-75wg-m249",
  ])
  assert.equal(report.audit.counts.high, 0)
  assert.equal(report.audit.counts.critical, 0)
  assert.ok(report.audit.advisories.every((id) => approved.has(id)), "unapproved production advisory")
  return report
}
