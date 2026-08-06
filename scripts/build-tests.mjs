import { build } from "esbuild"
import { readdirSync, rmSync } from "node:fs"
import path from "node:path"

const ROOTS = ["packages", "providers"]
const files = []
for (const root of ROOTS) {
  for (const entry of walk(path.resolve(root))) {
    if (entry.endsWith(".test.ts")) files.push(entry)
  }
}

function walk(directory) {
  const results = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "dist-tests") continue
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) results.push(...walk(full))
    else results.push(full)
  }
  return results
}

const packages = new Set()
for (const file of files) {
  const srcIndex = file.indexOf(`${path.sep}src${path.sep}`)
  packages.add(srcIndex >= 0 ? file.slice(0, srcIndex) : path.dirname(file))
}
for (const packageRoot of packages) {
  rmSync(path.join(packageRoot, "dist-tests"), { recursive: true, force: true })
}

for (const file of files) {
  const srcIndex = file.indexOf(`${path.sep}src${path.sep}`)
  const packageRoot = srcIndex >= 0 ? file.slice(0, srcIndex) : path.dirname(file)
  const relative = srcIndex >= 0 ? file.slice(srcIndex + 5) : path.basename(file)
  const outfile = path.join(packageRoot, "dist-tests", relative.replace(/\.ts$/, ".js"))
  await build({
    entryPoints: [file],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    external: ["node:*"],
    logLevel: "warning",
  })
}

console.log(`built ${files.length} test bundles`)
