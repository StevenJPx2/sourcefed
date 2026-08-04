import { setServer } from "./set-server.ts"
import { webhookState } from "./state.ts"

export function stopWebhookServer(): void {
  if (webhookState.server) webhookState.server.stop()
  setServer(undefined)
}
