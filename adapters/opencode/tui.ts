import type { Plugin } from "@opencode/plugin/tui"

// Synchronous entry: no top-level await (the local-path loader may not wait for
// TLA before reading exports). The compiled bundle's setup is loaded lazily on
// first call so its host-runtime imports resolve inside the TUI host.
type Setup = Plugin.Definition["setup"]

let setup: Setup | undefined

async function getSetup(): Promise<Setup> {
  if (!setup) {
    const mod = (await import("./tui-compiled.mjs")) as { default: Plugin.Definition }
    setup = mod.default.setup
  }
  return setup
}

export const id = "sourcefed-tui"

export default {
  id,
  setup: (ctx: Parameters<Setup>[0]) => getSetup().then((fn) => fn(ctx)),
} satisfies Plugin.Definition
