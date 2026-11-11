import { get as getHttp, type IncomingMessage } from "node:http"
import { get as getHttps } from "node:https"
import { Readable } from "node:stream"

/** Dedicated streaming sockets must not occupy the host's process-wide fetch queue. */
export async function openEventResponse(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<IncomingMessage> {
  signal.throwIfAborted()
  const endpoint = new URL(url)
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new Error("event stream requires HTTP or HTTPS")
  }
  const get = endpoint.protocol === "https:" ? getHttps : getHttp
  const response = await new Promise<IncomingMessage>((resolve, reject) => {
    // No global Agent: this socket belongs solely to the subscription and is never pooled.
    const request = get(endpoint, { headers, signal, agent: false }, resolve)
    request.once("error", reject)
  })
  if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
    response.destroy()
    throw new Error("event stream failed: " + response.statusCode)
  }
  return response
}

export function eventReader(response: IncomingMessage): import("node:stream/web").ReadableStreamDefaultReader<Uint8Array> {
  // IncomingMessage emits byte buffers; toWeb preserves Node's bounded read backpressure.
  return Readable.toWeb(response, {
    strategy: { highWaterMark: 64 * 1024, size: (chunk: Uint8Array) => chunk.byteLength },
  }).getReader()
}
