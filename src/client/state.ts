import type { createOpencodeClient } from "@opencode-ai/sdk"

export const clientState: {
  client: ReturnType<typeof createOpencodeClient> | undefined
} = {
  client: undefined,
}
