// Fails unless the `pi` found on PATH belongs to the expected Pi coding-agent version.
// Usage: node scripts/assert-pi-host.mjs [version]
// Without a version, the expected one is the Pi adapter's development pin.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, realpathSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const PI_PACKAGE = "@earendil-works/pi-coding-agent"
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const expected = process.argv[2] ?? adapterPin()
const binary = realpathSync(execFileSync("which", ["pi"], { encoding: "utf8" }).trim())
const manifest = owningManifest(binary)

console.log(`pi host: ${binary} (${manifest.name}@${manifest.version}), expected ${expected}`)
if (manifest.version !== expected) {
  throw new Error(`pi on PATH is ${manifest.version}, expected ${expected}`)
}

function adapterPin() {
  const adapter = JSON.parse(readFileSync(path.join(ROOT, "adapters/pi/package.json"), "utf8"))
  const pin = adapter.devDependencies?.[PI_PACKAGE]
  if (!pin) throw new Error(`adapters/pi/package.json has no ${PI_PACKAGE} development pin`)

  return pin
}

function owningManifest(file) {
  for (let dir = path.dirname(file); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const candidate = path.join(dir, "package.json")
    if (!existsSync(candidate)) continue

    const manifest = JSON.parse(readFileSync(candidate, "utf8"))
    if (manifest.name === PI_PACKAGE) return manifest
  }

  throw new Error(`${file} is not inside a ${PI_PACKAGE} package`)
}
