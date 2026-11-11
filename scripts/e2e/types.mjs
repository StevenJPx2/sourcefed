import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { command, environment } from "./harness.mjs"

const hostEntries = new Set(["./pi", "./tui", "./opencode/tui"])

// Pi 0.83.0, OpenTUI 0.8.1 and @types/node 26 ship these declaration errors.
// Each entry names one upstream source; any other diagnostic fails the gate.
export const upstreamDiagnostics = [
  { source: "pi-ai JSON model imports", code: "TS1543",
    file: /node_modules\/(?:.+\/)?@earendil-works\/pi-ai\/dist\/providers\/[\w-]+\.models\.d\.ts$/ },
  { source: "@anthropic-ai/sdk undici-types paths", code: "TS2307",
    file: /node_modules\/(?:.+\/)?@anthropic-ai\/sdk\/internal\/types\.d\.mts$/, message: /node_modules\/undici-types\/index\.d\.ts/ },
  { source: "@google/genai optional MCP SDK", code: "TS2307",
    file: /node_modules\/(?:.+\/)?@google\/genai\/dist\/node\/node\.d\.ts$/, message: /'@modelcontextprotocol\/sdk\/client\/index\.js'/ },
  { source: "@opentui/core KeyHandler.emit", code: "TS2416",
    file: /node_modules\/@opentui\/core\/lib\/KeyHandler\.d\.ts$/, message: /^Property 'emit' in type 'InternalKeyHandler'/ },
]

export function parseDiagnostics(output) {
  const diagnostics = []
  for (const line of output.split("\n")) {
    const match = /^(.+)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line)
    if (match) diagnostics.push({ file: match[1], code: match[4], message: match[5] })
    else if (/^\s/.test(line) && diagnostics.length) diagnostics.at(-1).message += "\n" + line
    else if (line.trim()) diagnostics.push({ file: "", code: "unknown", message: line })
  }
  return diagnostics
}

export function classifyDiagnostics(diagnostics) {
  const accepted = new Map()
  const unexpected = []
  for (const diagnostic of diagnostics) {
    const known = upstreamDiagnostics.find((rule) => rule.code === diagnostic.code &&
      rule.file.test(diagnostic.file) && (!rule.message || rule.message.test(diagnostic.message)))
    if (known) accepted.set(known.source, (accepted.get(known.source) ?? 0) + 1)
    else unexpected.push(diagnostic)
  }
  return { accepted: Object.fromEntries(accepted), unexpected }
}

export async function typesGate(context) {
  const manifest = JSON.parse(await readFile(path.join(context.packageDir, "package.json"), "utf8"))
  const entries = Object.keys(manifest.exports).filter((key) => key !== "./package.json")
  const library = entries.filter((key) => !hostEntries.has(key))
  assert.deepEqual(entries.filter((key) => hostEntries.has(key)).sort(), [...hostEntries].sort())
  const libraryResult = await compile(context, "library", {}, imports(library))
  assert.equal(libraryResult.code, 0, "library declarations: " + libraryResult.output)
  // The host fixture supplies the peers that Pi and OpenCode provide at runtime.
  const hostResult = await compile(context, "host", hostPeers, hostContract)
  const { accepted, unexpected } = classifyDiagnostics(parseDiagnostics(hostResult.output))
  assert.deepEqual(unexpected, [], "unexpected host declaration diagnostics")
  return { library: { entries: library, diagnostics: 0 },
    host: { entries: [...hostEntries], acceptedUpstream: accepted }, strict: true, skipLibCheck: false }
}

const hostPeers = {
  "@earendil-works/pi-coding-agent": "0.83.0", "@earendil-works/pi-tui": "0.83.0",
  typebox: "1.3.10", "@opencode/plugin": "2.2.7", "@opencode/theme": "2.2.7",
  "@opentui/core": "0.8.1", "@opentui/solid": "0.8.1", "solid-js": "1.9.19",
}

// Assignments prove the public types match the hosts' contracts; each expected
// error fails as unused if a Sourcefed declaration degrades to any.
const hostContract = [
  'import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"',
  'import type { Plugin } from "@opencode/plugin/tui"',
  'import sourcefedExtension from "@fdcn/sourcefed/pi"',
  'import tui, { id } from "@fdcn/sourcefed/tui"',
  'import openTui, { id as openId } from "@fdcn/sourcefed/opencode/tui"',
  "export const extension: (pi: ExtensionAPI) => Promise<void> = sourcefedExtension",
  "export const definitions: Plugin.Definition[] = [tui, openTui]",
  'export const ids: ["sourcefed-tui", "sourcefed-tui"] = [id, openId]',
  "// @ts-expect-error Pi supplies its extension API",
  "void sourcefedExtension()",
  "// @ts-expect-error OpenCode supplies the plugin context",
  "void tui.setup()",
  '// @ts-expect-error the plugin identifier is a literal',
  'export const wrong: "other" = openId',
].join("\n") + "\n"

function imports(entries) {
  return entries.map((key, index) => {
    const specifier = "@fdcn/sourcefed" + (key === "." ? "" : key.slice(1))
    return "import * as surface" + index + " from " + JSON.stringify(specifier) + "; void surface" + index + ";"
  }).join("\n") + "\n"
}

async function compile(context, name, devDependencies, source) {
  const directory = path.join(context.work, name + "-type-consumer")
  const env = await environment(path.join(directory, "isolation"))
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, "package.json"), JSON.stringify({ private: true, type: "module", devDependencies }))
  await command("npm", ["install", context.artifact, "--ignore-scripts", "--no-audit"], { cwd: directory, env, timeout: 300_000 })
  await writeFile(path.join(directory, "contract.ts"), source)
  await writeFile(path.join(directory, "tsconfig.json"), JSON.stringify({
    compilerOptions: { strict: true, noEmit: false, declaration: true,
      skipLibCheck: false, module: "NodeNext", moduleResolution: "NodeNext",
      target: "ES2022", outDir: "out", typeRoots: [path.join(context.tools, "node_modules/@types")] },
    files: ["contract.ts"],
  }))
  const result = await command(process.execPath, [path.join(context.tools, "node_modules/typescript/bin/tsc"),
    "-p", "tsconfig.json", "--pretty", "false"], { cwd: directory, env, check: false })
  const output = result.stdout + result.stderr
  await writeFile(path.join(context.root, ".release", "types-" + name + ".log"), output)
  return { code: result.code, output }
}
