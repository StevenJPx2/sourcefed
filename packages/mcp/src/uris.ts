import type { MonitorTarget } from "@sourcefed/core"

const PREFIX = "sourcefed://targets/"

export function eventResourceUri(target: MonitorTarget): string {
  return `${PREFIX}${encodeTarget(target)}/events`
}

export function encodeTarget(target: MonitorTarget): string {
  return Buffer.from(JSON.stringify(target), "utf8").toString("base64url")
}

export function decodeTarget(value: string): MonitorTarget | undefined {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    if (!parsed || typeof parsed !== "object") return undefined
    const target = parsed as Partial<MonitorTarget>
    if (typeof target.kind !== "string" || typeof target.id !== "string") return undefined
    return { kind: target.kind, id: target.id }
  } catch {
    return undefined
  }
}
