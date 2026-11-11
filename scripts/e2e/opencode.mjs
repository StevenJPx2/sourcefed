import path from "node:path"
import { command, evidence, environment } from "./harness.mjs"
import { scenario } from "./scenarios.mjs"
import { terminalGate } from "./terminal.mjs"

export async function opencodeGate(context) {
  const env = await environment(path.join(context.work, "opencode-probe"))
  const result = await command(process.execPath, [
    path.join(context.root, "scripts/check-opencode-subscriptions.mjs"), context.packageDir,
  ], { cwd: context.consumer, env, timeout: 90_000 })
  const report = JSON.parse(result.stdout)
  await scenario(context, "opencode.test.mjs")
  return report
}

export const tuiGate = terminalGate

export async function visualGate(context) {
  return evidence(context, context.options["tui-proof"], "opencode-tui", [
    "real-termctrl", "sidebar", "monitor-dialog", "logs-dialog", "padding",
    "no-clipping", "no-duplicate-ids",
  ])
}
