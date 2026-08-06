import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"

// Synchronous entry: no top-level await (the local-path loader may not wait
// for TLA before reading exports). The compiled bundle's tui is loaded lazily
// on first call instead.
let tui: TuiPlugin | undefined

async function getTui(): Promise<TuiPlugin> {
  if (!tui) {
    const mod = (await import("./tui-compiled.mjs")) as { default: { tui: TuiPlugin } }
    tui = mod.default.tui
  }
  return tui
}

export const id = "sourcefed-tui"

export default {
  id,
  tui: ((api: Parameters<TuiPlugin>[0], options: Parameters<TuiPlugin>[1], meta: Parameters<TuiPlugin>[2]) =>
    getTui().then((fn) => fn(api, options, meta))) as TuiPlugin,
} satisfies TuiPluginModule
