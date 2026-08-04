import type { createOpencodeClient } from "@opencode-ai/sdk"
import { clientState } from "./state.ts"

export function setClient(value: ReturnType<typeof createOpencodeClient>): void {
  clientState.client = value
}
