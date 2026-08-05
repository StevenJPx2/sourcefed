import { inflateRawSync } from "node:zlib"
import { githubToken } from "./client.ts"

const API = "https://api.github.com"
const MAX_LOG_BYTES = 10_000_000
const MAX_ENTRY_BYTES = 5_000_000
const MAX_TOTAL_BYTES = 50_000_000

export async function fetchRunLog(repo: string, runId: string): Promise<string | undefined> {
  const token = githubToken()
  if (!token) return undefined
  try {
    const response = await fetch(`${API}/repos/${repo}/actions/runs/${runId}/logs`, {
      headers: { authorization: `Bearer ${token}`, "user-agent": "sourcefed", accept: "application/vnd.github+json" },
    })
    if (!response.ok || !response.body) return undefined
    const length = Number(response.headers.get("content-length") ?? 0)
    if (length > MAX_LOG_BYTES) return undefined
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_LOG_BYTES) return undefined
      chunks.push(value)
    }
    const buffer = concatChunks(chunks)
    const entries = extractZipEntries(buffer)
    return entries.map((entry) => new TextDecoder().decode(entry.content)).join("\n")
  } catch {
    return undefined
  }
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

export function extractZipEntries(buffer: Uint8Array): { name: string; content: Uint8Array }[] {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  let end = -1
  const scanStart = Math.max(0, buffer.length - 65_557)
  for (let offset = buffer.length - 22; offset >= scanStart; offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      end = offset
      break
    }
  }
  if (end < 0) return []
  const entryCount = view.getUint16(end + 10, true)
  let cursor = view.getUint32(end + 16, true)
  const entries: { name: string; content: Uint8Array }[] = []
  let totalBytes = 0
  for (let index = 0; index < entryCount; index++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break
    const method = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const name = new TextDecoder().decode(buffer.slice(cursor + 46, cursor + 46 + nameLength))
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const compressed = buffer.slice(dataStart, dataStart + compressedSize)
    let content: Uint8Array
    if (method === 8) {
      const declaredSize = view.getUint32(localOffset + 22, true)
      if (declaredSize > MAX_ENTRY_BYTES) {
        cursor += 46 + nameLength + extraLength + commentLength
        continue
      }
      try {
        content = inflateRawSync(compressed)
      } catch {
        content = compressed
      }
    } else {
      content = compressed
    }
    totalBytes += content.length
    if (totalBytes > MAX_TOTAL_BYTES) break
    entries.push({ name, content })
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return entries
}
