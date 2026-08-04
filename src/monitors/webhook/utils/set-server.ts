import { webhookState } from "./state.ts"

export function setServer(value: ReturnType<typeof Bun.serve> | undefined): void {
  webhookState.server = value
}
