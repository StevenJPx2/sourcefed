import { execFile } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

export function setupSpec(): string {
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")) as { name?: string; version?: string }
  if (manifest.name === "@fdcn/sourcefed" && manifest.version) return `@fdcn/sourcefed@${manifest.version}`
  return "@fdcn/sourcefed@latest"
}

export async function setupHost(name: string, args: string[], spec: string): Promise<boolean> {
  console.error(`[sourcefed] installing ${spec} into ${name}`)

  try {
    await execFile(name, args)
    console.error(`[sourcefed] ${name} configured — restart ${name} to load the plugin`)

    return true
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : ""

    if (code === "ENOENT") {
      console.error(`[sourcefed] ${name} is not on PATH — install it manually:`)
      console.error(name === "opencode" ? `  add "${spec}" to the plugins array in ~/.config/opencode/opencode.jsonc and cli.json` : `  run: pi install ${spec}`)

      return false
    }

    throw error
  }
}

export function configureOpenCodeCliPlugin(spec: string): void {
  const file = openCodeCliConfigPath()
  const config = readOpenCodeCliConfig(file)
  const plugins = config.plugins

  if (plugins === undefined) {
    config.plugins = [spec]
  } else if (!Array.isArray(plugins)) {
    throw new Error(`OpenCode CLI config has a non-array plugins setting: ${file}`)
  } else if (!plugins.some((plugin) => isPluginEntry(plugin, spec))) {
    config.plugins = [...plugins, spec]
  } else {
    return
  }

  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`)
}

function openCodeCliConfigPath(): string {
  const configHome = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config")

  return path.join(configHome, "opencode", "cli.json")
}

function readOpenCodeCliConfig(file: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(readFileSync(file, "utf8"))

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`OpenCode CLI config must contain a JSON object: ${file}`)
    }

    return value as Record<string, unknown>
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return {}
    if (error instanceof SyntaxError) throw new Error(`OpenCode CLI config is not valid JSON: ${file}`)

    throw error
  }
}

function isPluginEntry(value: unknown, spec: string): boolean {
  if (value === spec) return true
  if (!value || typeof value !== "object" || Array.isArray(value)) return false

  return "package" in value && value.package === spec
}
