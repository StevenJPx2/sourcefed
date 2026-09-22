import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { removeDir, run, tempDir } from "./harness.mjs"

const dir = await tempDir("sourcefed-it-setup-")
const binDir = path.join(dir, "bin")
const capture = path.join(dir, "args")
const configHome = path.join(dir, "config")
const cli = path.resolve("node_modules/@fdcn/sourcefed/dist/cli.js")
const manifest = JSON.parse(readFileSync(path.resolve("node_modules/@fdcn/sourcefed/package.json"), "utf8"))
mkdirSync(binDir, { recursive: true })
mkdirSync(path.join(configHome, "opencode"), { recursive: true })
writeFileSync(path.join(configHome, "opencode", "cli.json"), JSON.stringify({ theme: { name: "gruvbox" }, plugins: ["existing"] }))

const fakeOpenCode = path.join(binDir, "opencode")
writeFileSync(fakeOpenCode, "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$SOURCEFED_SETUP_CAPTURE\"\n")
chmodSync(fakeOpenCode, 0o755)

try {
  run(process.execPath, [cli, "setup", "opencode"], {
    env: {
      PATH: `${binDir}:${process.env.PATH}`,
      SOURCEFED_SETUP_CAPTURE: capture,
      XDG_CONFIG_HOME: configHome,
    },
  })

  const args = readFileSync(capture, "utf8").trim().split("\n")
  const expected = ["plugin", "add", `@fdcn/sourcefed@${manifest.version}`]
  if (args.join("\0") !== expected.join("\0")) {
    throw new Error(`unexpected OpenCode installer arguments: ${JSON.stringify(args)}`)
  }

  const cliConfig = JSON.parse(readFileSync(path.join(configHome, "opencode", "cli.json"), "utf8"))
  if (cliConfig.theme.name !== "gruvbox" || !cliConfig.plugins.includes(`@fdcn/sourcefed@${manifest.version}`)) {
    throw new Error(`unexpected OpenCode CLI config: ${JSON.stringify(cliConfig)}`)
  }

  console.log("setup: uses the OpenCode v2 plugin add command — ok")
} finally {
  await removeDir(dir)
}
