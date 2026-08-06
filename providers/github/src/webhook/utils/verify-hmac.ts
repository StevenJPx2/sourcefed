import { createHmac, timingSafeEqual } from "node:crypto"

export function verifyHmac(body: string, signature: string | null, secret: string | undefined): boolean {
  if (!secret || !signature) return false
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`
  const actual = Buffer.from(signature)
  const wanted = Buffer.from(expected)
  return actual.length === wanted.length && timingSafeEqual(actual, wanted)
}
