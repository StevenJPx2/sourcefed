import { clientState } from "./state.ts"

export function getClient(): NonNullable<typeof clientState.client> {
  if (clientState.client) return clientState.client
  throw new Error("sourcefed client has not been initialized")
}
