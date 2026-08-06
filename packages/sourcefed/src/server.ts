import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import type { Hooks } from "@opencode-ai/plugin"
import Sourcefed from "../../../adapters/opencode/index.ts"

const guidance = readFileSync(fileURLToPath(new URL("./guidance.md", import.meta.url)), "utf8")

export default {
  id: "sourcefed",
  server: async (input: Parameters<typeof Sourcefed>[0]): Promise<Hooks> => {
    const hooks = await Sourcefed(input)
    return {
      ...hooks,
      "experimental.chat.system.transform": async (_input, output) => {
        if (!output.system.some((part) => part.includes("sourcefed"))) {
          output.system.push(guidance)
        }
      },
    }
  },
}
