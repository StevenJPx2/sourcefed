import { spawn } from "node:child_process"

export function runSlackCli(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("slackcli", args, { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout)
        return
      }
      reject(new Error(stderr.trim() || `slackcli exited with code ${code ?? "unknown"}`))
    })
  })
}
