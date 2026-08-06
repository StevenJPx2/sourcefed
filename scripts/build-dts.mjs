import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const DTS = path.join(ROOT, "packages/sourcefed/dist.dts")

execFileSync("npx", ["tsc", "-p", "packages/sourcefed/tsconfig.json"], { cwd: ROOT, stdio: "inherit" })

let rewritten = 0
for (const file of walk(DTS)) {
  if (!file.endsWith(".d.ts")) continue
  const source = readFileSync(file, "utf8")
  const next = source
    .replace(/(["'])@sourcefed\/([^"']+)\1/g, "$1@fdcn/sourcefed/$2$1")
    .replace(/(\.\.?\/[^"']+)\.tsx?(["'])/g, "$1.js$2")
  if (next !== source) {
    writeFileSync(file, next)
    rewritten += 1
  }
}

console.log(`built public declarations (${rewritten} files rewritten)`)

function walk(directory) {
  const results = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) results.push(...walk(full))
    else results.push(full)
  }
  return results
}
