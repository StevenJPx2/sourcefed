import { copyFile } from "node:fs/promises"
import path from "node:path"
import { command, environment } from "./harness.mjs"
import { scenario } from "./scenarios.mjs"

export async function mcpHttpGate(context) {
  return scenario(context, "mcp.test.mjs")
}

export async function mcpStdioGate(context) {
  const directory = path.join(context.tools, "scenarios")
  await copyFile(path.join(context.root, "scripts/e2e/mcp-stdio.worker.mjs"), path.join(directory, "mcp-stdio.worker.mjs"))
  await copyFile(path.join(context.root, "scripts/integration/harness.mjs"), path.join(directory, "harness.mjs"))
  const env = await environment(path.join(context.work, "mcp-stdio"), {
    SOURCEFED_STATE_DIR: path.join(context.work, "mcp-stdio/daemon"),
  })
  const result = await command(process.execPath, [path.join(directory, "mcp-stdio.worker.mjs")], {
    cwd: context.consumer, env, timeout: 45_000,
  })
  return { output: result.stdout.trim() }
}
