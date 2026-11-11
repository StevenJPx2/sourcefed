import assert from "node:assert/strict"
import { constants } from "node:fs"
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { command } from "./harness.mjs"

export async function packageGate(context) {
  const { consumer, env, artifact, version } = context
  await mkdir(consumer, { recursive: true })
  await writeFile(path.join(consumer, "package.json"), JSON.stringify({
    name: "sourcefed-release-consumer", private: true, type: "module",
  }))
  const listing = (await command("tar", ["-tzf", artifact], { cwd: consumer, env })).stdout
  const entries = listing.trim().split("\n")
  assert.ok(entries.every((p) => p.startsWith("package/") && !p.split("/").includes("..")))
  assert.ok(!entries.some((p) => /(?<!\.d)\.tsx?$/.test(p)), "no TypeScript runtime sources")
  await command("npm", ["install", artifact, "--omit=dev", "--ignore-scripts", "--no-audit"], { cwd: consumer, env, timeout: 300_000 })
  const packageDir = path.join(consumer, "node_modules/@fdcn/sourcefed")
  const manifest = JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf8"))
  assert.equal(manifest.name, "@fdcn/sourcefed")
  assert.equal(manifest.version, version)
  for (const key of [".", "./core", "./core/storage", "./daemon", "./mcp", "./server", "./tui", "./opencode", "./opencode/tui", "./pi"]) {
    assert.ok(manifest.exports[key], `export ${key}`)
    const target = manifest.exports[key]
    for (const file of typeof target === "string" ? [target] : Object.values(target)) {
      await access(path.join(packageDir, file))
    }
  }
  assert.deepEqual(manifest.pi.extensions, ["./dist/pi.js"])
  await access(path.join(consumer, "node_modules/.bin/sourcefed"), constants.X_OK)
  for (const file of ["README.md", "LICENSE", "dist/guidance.md", "dist/data", "dist.dts"]) {
    await access(path.join(packageDir, file))
  }
  await assert.rejects(access(path.join(consumer, "node_modules/@sourcefed")), { code: "ENOENT" })
  const lock = JSON.parse(await readFile(path.join(consumer, "package-lock.json"), "utf8"))
  assert.ok(!Object.keys(lock.packages).some((p) => p.includes("node_modules/@earendil-works/pi-")))
  for (const file of await files(packageDir)) {
    if (!file.endsWith(".js") && !file.endsWith(".mjs") && !file.endsWith(".d.ts")) continue
    const source = await readFile(file, "utf8")
    const privateImport = /(?:from|import)\s*(?:\(\s*)?["']@sourcefed\//
    assert.ok(!privateImport.test(source), `private package import in ${file}`)
  }
  context.packageDir = packageDir
  return { files: entries.length, version, noPrivatePackages: true, noPiPackages: true }
}

async function files(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await files(file))
    else result.push(file)
  }
  return result
}
