import assert from "node:assert/strict"
import { build } from "esbuild"
import { chmodSync, copyFileSync, cpSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { define } from "./build-define.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUT = path.join(ROOT, "packages/sourcefed/dist")

const ENTRIES = [
  { name: "cli", source: "packages/cli/src/index.ts" },
  { name: "core", source: "packages/core/src/index.ts" },
  { name: "core-storage", source: "packages/core/src/storage/index.ts" },
  { name: "daemon", source: "packages/daemon/src/index.ts" },
  { name: "mcp", source: "packages/mcp/src/index.ts" },
  { name: "opencode", source: "packages/sourcefed/src/server.ts" },
  { name: "pi", source: "adapters/pi/src/index.ts" },
]

const PI_HOST_PACKAGES = [
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
  "typebox",
]
const manifest = JSON.parse(readFileSync(path.join(ROOT, "packages/sourcefed/package.json"), "utf8"))
for (const name of PI_HOST_PACKAGES) {
  assert.equal(manifest.dependencies?.[name], undefined, `${name} must be host-provided`)
  assert.equal(manifest.peerDependencies?.[name], "*", `${name} must accept the Pi host version`)
  assert.equal(manifest.peerDependenciesMeta?.[name]?.optional, true, `${name} must be optional`)
}

const EXTERNAL = [
  "node:*",
  "@modelcontextprotocol/server",
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
  "typebox",
  "@opencode/plugin",
  "@opencode/plugin/*",
]

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const bundled = await build({
  metafile: true,
  entryPoints: ENTRIES.map(({ name, source }) => ({ in: path.join(ROOT, source), out: name })),
  outdir: OUT,
  entryNames: "[name]",
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "node",
  target: "node22",
  external: EXTERNAL,
  define,
  logLevel: "warning",
})

verifyHostIsolation(bundled.metafile)

await build({
  entryPoints: [path.join(ROOT, "packages/cli/src/index.ts")],
  outfile: path.join(OUT, "cli.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  external: EXTERNAL,
  define,
  logLevel: "warning",
})

chmodSync(path.join(OUT, "cli.js"), 0o755)
copyFileSync(path.join(ROOT, "adapters/opencode/tui-compiled.mjs"), path.join(OUT, "tui-compiled.mjs"))
copyFileSync(path.join(ROOT, "GUIDANCE.md"), path.join(OUT, "guidance.md"))
cpSync(path.join(ROOT, "packages/cli/src/skills/data"), path.join(OUT, "data"), { recursive: true })

console.log(`built public package dist (${ENTRIES.length} entries + tui bundle + skills data)`)

function verifyHostIsolation(metafile) {
  for (const [file, output] of Object.entries(metafile.outputs)) {
    if (!output.entryPoint || file.endsWith("/pi.js")) continue
    const pending = [file]
    const visited = new Set()

    while (pending.length) {
      const current = pending.pop()
      if (visited.has(current)) continue
      visited.add(current)
      const chunk = metafile.outputs[current]
      assert.ok(chunk, `missing build metadata for ${current}`)

      for (const imported of chunk.imports) {
        if (imported.external) {
          const isHostPackage = PI_HOST_PACKAGES.some((name) =>
            imported.path === name || imported.path.startsWith(name + "/"),
          )
          assert.ok(!isHostPackage, `${file} imports ${imported.path}`)
        } else {
          pending.push(imported.path)
        }
      }
    }
  }
}
