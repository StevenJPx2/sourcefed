import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const INTEGRATION = path.join(ROOT, ".integration")
const CONSUMER = path.join(INTEGRATION, "consumer")
const SCENARIOS = path.join(ROOT, "scripts/integration")

const PACKAGES = [
  "packages/core",
  "packages/daemon",
  "packages/mcp",
  "packages/cli",
  "providers/jira",
  "providers/github",
  "providers/slack",
]

run("node", ["scripts/build.mjs"], ROOT)
rmSync(INTEGRATION, { recursive: true, force: true })
mkdirSync(path.join(CONSUMER, "scenarios"), { recursive: true })

const dependencies = { "@modelcontextprotocol/client": "2.0.0" }
for (const packageDir of PACKAGES) {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, packageDir, "package.json"), "utf8"))
  execFileSync("npm", ["pack", path.join(ROOT, packageDir), "--pack-destination", INTEGRATION], { cwd: ROOT, stdio: "inherit" })
  const tarball = `${manifest.name.replace(/^@/, "").replace("/", "-")}-${manifest.version}.tgz`
  dependencies[manifest.name] = `file:${path.join(INTEGRATION, tarball)}`
}

writeFileSync(path.join(CONSUMER, "package.json"), JSON.stringify({
  name: "sourcefed-integration-consumer",
  version: "0.0.0",
  private: true,
  type: "module",
  dependencies,
}, null, 2))

run("npm", ["install", "--no-audit", "--no-fund"], CONSUMER)

for (const entry of readdirSync(SCENARIOS).filter((name) => name.endsWith(".mjs"))) {
  cpSync(path.join(SCENARIOS, entry), path.join(CONSUMER, "scenarios", entry))
}

const scenarioNames = readdirSync(path.join(CONSUMER, "scenarios")).filter((name) => name.endsWith(".test.mjs"))
let passed = 0
const failures = []
for (const name of scenarioNames.sort()) {
  try {
    execFileSync(process.execPath, [path.join(CONSUMER, "scenarios", name)], { cwd: CONSUMER, stdio: "inherit", timeout: 180_000 })
    console.log(`\n\u001b[32mPASS\u001b[0m ${name}`)
    passed += 1
  } catch (error) {
    console.log(`\n\u001b[31mFAIL\u001b[0m ${name}`)
    failures.push(name)
  }
}

console.log(`\n${passed}/${scenarioNames.length} integration scenarios passed`)
if (failures.length > 0) {
  console.error(`failed: ${failures.join(", ")}`)
  process.exitCode = 1
}

function run(command, args, cwd) {
  console.log(`$ ${command} ${args.join(" ")}`)
  execFileSync(command, args, { cwd, stdio: "inherit" })
}
