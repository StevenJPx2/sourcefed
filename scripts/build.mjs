import { build } from "esbuild"
import { chmod, cpSync } from "node:fs"

const ENTRIES = [
  { entry: "packages/core/src/index.ts", outfile: "packages/core/dist/index.js" },
  { entry: "packages/core/src/storage/index.ts", outfile: "packages/core/dist/storage/index.js" },
  { entry: "providers/jira/src/index.ts", outfile: "providers/jira/dist/index.js" },
  { entry: "providers/github/src/index.ts", outfile: "providers/github/dist/index.js" },
  { entry: "providers/slack/src/index.ts", outfile: "providers/slack/dist/index.js" },
  { entry: "packages/daemon/src/index.ts", outfile: "packages/daemon/dist/index.js" },
  { entry: "packages/mcp/src/index.ts", outfile: "packages/mcp/dist/index.js" },
  { entry: "packages/cli/src/index.ts", outfile: "packages/cli/dist/index.js" },
]

for (const entry of ENTRIES) {
  await build({
    entryPoints: [entry.entry],
    outfile: entry.outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    external: ["node:*"],
    logLevel: "warning",
  })
}

cpSync("packages/cli/src/skills/data", "packages/cli/dist/data", { recursive: true })

console.log(`built ${ENTRIES.length} bundles`)
