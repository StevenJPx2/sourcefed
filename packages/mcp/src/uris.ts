import type { MonitorTarget } from "@sourcefed/core"
import { encodeTarget } from "@sourcefed/daemon"

const PREFIX = "sourcefed://targets/"

export function eventResourceUri(target: MonitorTarget): string {
  return `${PREFIX}${encodeTarget(target)}/events`
}

export { decodeTarget, encodeTarget } from "@sourcefed/daemon"
