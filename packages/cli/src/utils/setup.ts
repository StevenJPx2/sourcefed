import { execFile } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

export function setupSpec(): string {
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")) as { name?: string; version?: string }
  if (manifest.name === "@fdcn/sourcefed" && manifest.version) return `@fdcn/sourcefed@${manifest.version}`
  return "@fdcn/sourcefed@latest"
}

export async function setupHost(name: string, args: string[], spec: string): Promise<void> {
  console.error(`[sourcefed] installing ${spec} into ${name}`)
  try {
    await execFile(name, args)
    console.error(`[sourcefed] ${name} configured — restart ${name} to load the plugin`)
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : ""
    if (code === "ENOENT") {
      console.error(`[sourcefed] ${name} is not on PATH — install it manually:`)
      console.error(name === "opencode" ? `  add "${spec}" to the plugin array in ~/.config/opencode/opencode.jsonc and tui.json` : `  run: pi install ${spec}`)
      return
    }
    throw error
  }
}
