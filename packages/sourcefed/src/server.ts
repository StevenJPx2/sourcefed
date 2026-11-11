import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Plugin } from "@opencode/plugin"
import type { SessionContext } from "@opencode/plugin/promise/session"
import { setupSourcefed } from "../../../adapters/opencode/index.ts"

const guidance = readFileSync(fileURLToPath(new URL("./guidance.md", import.meta.url)), "utf8")

// The guidance's first line. Any system text can say "sourcefed" (a working
// directory inside the sourcefed repo does), so only this marks a copy.
const heading = guidance.split("\n", 1)[0] ?? guidance

export default Plugin.define({
  id: "sourcefed",
  async setup(ctx) {
    const cleanup = await setupSourcefed(ctx)

    try {
      // Inject Sourcefed guidance into the agent's system context once per request.
      // Compaction and generate requests (such as cache warming) get it too: a
      // system prompt that differs between request kinds misses the prompt cache.
      const inject = (event: SessionContext) => {
        if (!event.system.some((part) => part.type === "text" && part.text.includes(heading))) {
          event.system.push({ type: "text", text: guidance })
        }
      }

      await ctx.session.hook("context", inject)
      await ctx.session.hook("compaction", inject)
      await ctx.session.hook("generate", inject)
    } catch (error) {
      await cleanup?.()
      throw error
    }

    return cleanup
  },
})
