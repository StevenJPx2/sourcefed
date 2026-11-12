import { githubToken } from "./client.ts"

const API = "https://api.github.com"
const MAX_LOG_BYTES = 10_000_000

export async function fetchJobLog(repo: string, jobId: string): Promise<string | undefined> {
  const token = githubToken()
  if (!token) return undefined
  try {
    const response = await fetch(`${API}/repos/${repo}/actions/jobs/${jobId}/logs`, {
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
      if (total > MAX_LOG_BYTES) {
        await reader.cancel()
        return undefined
      }
      chunks.push(value)
    }
    return new TextDecoder().decode(concatChunks(chunks))
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
