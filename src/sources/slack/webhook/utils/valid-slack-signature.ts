import { timingSafeEqual } from "node:crypto"
import { slackSignature } from "./slack-signature.ts"

export function validSlackSignature(body: string, request: Request, secret = process.env.SOURCEFED_SLACK_SIGNING_SECRET): boolean {
  const timestamp = request.headers.get("x-slack-request-timestamp")
  const signature = request.headers.get("x-slack-signature")
  const timestampValue = Number(timestamp)
  if (!timestamp || !signature || !secret || !Number.isFinite(timestampValue) || Math.abs(Date.now() / 1000 - timestampValue) > 300) return false
  const expected = slackSignature(body, timestamp, secret)
  const actual = Buffer.from(signature)
  const wanted = Buffer.from(expected)
  return actual.length === wanted.length && timingSafeEqual(actual, wanted)
}
