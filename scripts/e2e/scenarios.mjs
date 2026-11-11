import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { command, environment } from "./harness.mjs"

export async function prepareTools(context) {
  const tools = path.join(context.work, "tools")
  await mkdir(tools, { recursive: true })
  const version = async (name) => JSON.parse(await readFile(path.join(context.root, "node_modules", name, "package.json"), "utf8")).version
  await writeFile(path.join(tools, "package.json"), JSON.stringify({ private: true, type: "module" }))
  await command("npm", ["install", "--ignore-scripts", "--no-audit",
    `typescript@${await version("typescript")}`, `@types/node@${await version("@types/node")}`,
    "@modelcontextprotocol/client@2.4.0"], { cwd: tools, env: context.env })
  context.tools = tools
  return { registryTools: true }
}

export async function scenario(context, name) {
  const directory = path.join(context.tools, "scenarios")
  await mkdir(directory, { recursive: true })
  for (const file of ["harness.mjs", name]) {
    await copyFile(path.join(context.root, "scripts/integration", file), path.join(directory, file))
  }
  const env = await environment(path.join(context.work, name), {
    SOURCEFED_TEST_DAEMON_ENTRY: pathToFileURL(path.join(context.packageDir, "dist/daemon.js")).href,
  })
  const result = await command(process.execPath, [path.join(directory, name)], {
    cwd: context.consumer, env, timeout: 90_000,
  })
  if (/\bSKIP(?:PED)?\b/i.test(result.stdout + result.stderr)) throw new Error(`${name}: skipped scenario`)
  return { scenario: name, output: result.stdout.trim() }
}
