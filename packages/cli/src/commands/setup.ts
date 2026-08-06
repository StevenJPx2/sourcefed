import { setupHost, setupSpec } from "../utils/setup.ts"

export async function runSetup(args: string[]): Promise<void> {
  const spec = setupSpec()
  const requested = args[0] ?? "all"
  if (requested === "opencode" || requested === "all") {
    await setupHost("opencode", ["plugin", spec, "--global"], spec)
  }
  if (requested === "pi" || requested === "all") {
    await setupHost("pi", ["install", `npm:${spec}`], `npm:${spec}`)
  }
}
