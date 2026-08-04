import { verifyHmac } from "./verify-hmac.ts"

export function verifyGithubWebhook(body: string, request: Request): boolean {
  return verifyHmac(body, request.headers.get("x-hub-signature-256"), process.env.SOURCEFED_GITHUB_WEBHOOK_SECRET)
}
