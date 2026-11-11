import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const declarations = path.join(root, "packages/sourcefed/dist.dts")
const workspaces = workspaceManifests()

rmSync(declarations, { recursive: true, force: true })
execFileSync(process.execPath, [path.join(root, "node_modules/typescript/bin/tsc"), "-p", "packages/sourcefed/tsconfig.json"], {
  cwd: root, stdio: "inherit", timeout: 60000,
})

let rewritten = 0
for (const file of walk(declarations)) {
  if (!file.endsWith(".d.ts")) continue
  const source = readFileSync(file, "utf8")
  const next = source.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])([^"'\n]+)\2/g, (literal, prefix, quote, specifier) => {
    const resolved = resolveDeclaration(file, specifier)
    return resolved ? prefix + quote + resolved + quote : literal
  })
  if (source !== next) {
    writeFileSync(file, next)
    rewritten++
  }
}
console.log(`built NodeNext-compatible public declarations (${rewritten} files rewritten)`)

function workspaceManifests() {
  const manifests = []
  for (const directory of ["packages", "providers", "adapters"]) {
    for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const base = path.join(directory, entry.name)
      const file = path.join(root, base, "package.json")
      if (existsSync(file)) manifests.push({ base, ...JSON.parse(readFileSync(file, "utf8")) })
    }
  }
  return manifests
}

function resolveDeclaration(file, specifier) {
  let target
  if (specifier.startsWith("@sourcefed/")) {
    const workspace = workspaces.find((item) => specifier === item.name || specifier.startsWith(item.name + "/"))
    if (!workspace) throw new Error(`unknown private type module ${specifier}`)
    const subpath = "." + specifier.slice(workspace.name.length)
    const exported = workspace.exports[subpath]
    const source = typeof exported === "string" ? exported : exported?.types
    if (!source) throw new Error(`missing type export for ${specifier}`)
    target = path.join(declarations, workspace.base, source.replace(/\.tsx?$/, ".d.ts"))
  } else if (specifier.startsWith("#sourcefed/")) {
    const source = workspaces.find((item) => item.name === "@sourcefed/core").imports[specifier]
    if (!source) throw new Error(`unknown internal type alias ${specifier}`)
    target = path.join(declarations, "packages/core", source.replace(/\.tsx?$/, ".d.ts"))
  } else if (specifier.startsWith(".")) {
    const base = path.resolve(path.dirname(file), specifier.replace(/\.[jt]sx?$/, ""))
    target = [base + ".d.ts", path.join(base, "index.d.ts")].find(existsSync)
    if (!target) throw new Error(`unresolved relative declaration ${specifier} in ${file}`)
  } else {
    return
  }
  if (!existsSync(target)) throw new Error(`missing declaration ${target}`)
  const relative = path.relative(path.dirname(file), target).split(path.sep).join("/").replace(/\.d\.ts$/, ".js")
  return relative.startsWith(".") ? relative : "./" + relative
}

function walk(directory) {
  const result = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...walk(file))
    else result.push(file)
  }
  return result
}
