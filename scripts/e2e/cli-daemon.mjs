import { scenario } from "./scenarios.mjs"

export async function cliDaemonGate(context) {
  return scenario(context, "cli.test.mjs")
}
