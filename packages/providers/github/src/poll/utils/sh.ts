import { spawnSync } from "node:child_process"

export function sh(args: string[]): { code: number; out: string } {
  const process = spawnSync("gh", args, { encoding: "utf8" })
  let code = process.status
  if (code === null) code = -1
  let out = process.stdout ?? ""
  out += process.stderr ?? ""
  return { code, out }
}
