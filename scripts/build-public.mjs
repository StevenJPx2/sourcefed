import { build } from "esbuild"
import { chmodSync, copyFileSync, cpSync, mkdirSync, rmSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

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

const EXTERNAL = [
  "node:*",
  "@modelcontextprotocol/server",
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
  "typebox",
]

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

await build({
  entryPoints: ENTRIES.map(({ name, source }) => ({ in: path.join(ROOT, source), out: name })),
  outdir: OUT,
  entryNames: "[name]",
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "node",
  target: "node22",
  external: EXTERNAL,
  logLevel: "warning",
})

await build({
  entryPoints: [path.join(ROOT, "packages/cli/src/index.ts")],
  outfile: path.join(OUT, "cli.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  external: EXTERNAL,
  logLevel: "warning",
})

chmodSync(path.join(OUT, "cli.js"), 0o755)
copyFileSync(path.join(ROOT, "adapters/opencode/tui-compiled.mjs"), path.join(OUT, "tui-compiled.mjs"))
copyFileSync(path.join(ROOT, "GUIDANCE.md"), path.join(OUT, "guidance.md"))
cpSync(path.join(ROOT, "packages/cli/src/skills/data"), path.join(OUT, "data"), { recursive: true })

console.log(`built public package dist (${ENTRIES.length} entries + tui bundle + skills data)`)
