import { createHmac } from "node:crypto"

export function slackSignature(body: string, timestamp: string, secret: string): string {
  return `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")}`
}
