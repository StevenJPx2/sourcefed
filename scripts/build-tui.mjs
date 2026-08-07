import { transformSolidSource } from "../node_modules/@opentui/solid/scripts/solid-transform.js"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { build } from "esbuild"

// Builds the OpenCode TUI plugin bundle. Two things are required for the
// sidebar to actually render and stay reactive inside the host:
//
// 1. Solid transform — esbuild's plain JSX evaluates expressions eagerly, so
//    signal updates never re-render. babel-preset-solid (via @opentui/solid's
//    transform) emits createComponent/insert/effect calls with reactive
//    getters instead.
// 2. Host runtime modules — the transform rewrites solid-js/@opentui/solid
//    imports to `opentui:runtime-module:` so the plugin shares the host's
//    single Solid runtime (a second copy would never receive signal updates).
//
// The entry must also default-export `{ id, tui }` — the local-path plugin
// loader requires both a named `id` and a default object with `tui()`, and
// rejects modules whose top-level await delays those exports.

const RUNTIME_MODULE = "opentui:runtime-module:"
const SRC = "adapters/opencode/tui"
const OUT = ".tui-build/tui"
const OUT_BUNDLE = "adapters/opencode/tui-compiled.mjs"

async function transformFile(src, out) {
  const code = readFileSync(src, "utf8")
  const transformed = await transformSolidSource(code, {
    filename: src,
    moduleName: "@opentui/solid",
    resolvePath: (specifier) => {
      if (specifier === "solid-js" || specifier.startsWith("solid-js/")) return RUNTIME_MODULE + encodeURIComponent(specifier)
      if (specifier === "@opentui/solid" || specifier.startsWith("@opentui/solid/")) return RUNTIME_MODULE + encodeURIComponent(specifier)
      // Keep the daemon client external and pointed at the published subpath, so the
      // TUI bundle imports connectDaemonClient at runtime instead of inlining the whole
      // daemon (registry + every provider) into the plugin.
      if (specifier === "@sourcefed/daemon") return "@fdcn/sourcefed/daemon"
      return specifier
    },
  })
  writeFileSync(out, transformed)
  return out
}

mkdirSync(OUT, { recursive: true })
await transformFile(`${SRC}/sidebar.tsx`, `${OUT}/sidebar.mjs`)
await transformFile(`${SRC}/plugin.tsx`, `${OUT}/plugin.mjs`)

// plugin.tsx imports "./sidebar.tsx" — point it at the transformed .mjs
const pluginPath = `${OUT}/plugin.mjs`
writeFileSync(pluginPath, readFileSync(pluginPath, "utf8").replace("./sidebar.tsx", "./sidebar.mjs"))

// default-export entry: plugin.mjs only has the named sourcefedTui export
writeFileSync(`${OUT}/index.mjs`, [
  `import { sourcefedTui } from "./plugin.mjs"`,
  `export const id = "sourcefed-tui"`,
  `export default { id, tui: sourcefedTui }`,
  ``,
].join("\n"))

await build({
  entryPoints: [`${OUT}/index.mjs`],
  outfile: OUT_BUNDLE,
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ["node:*", "@opencode-ai/plugin/tui", "@fdcn/sourcefed/daemon", "opentui:runtime-module:*"],
  logLevel: "info",
})

console.log(`built TUI bundle (${OUT_BUNDLE})`)
