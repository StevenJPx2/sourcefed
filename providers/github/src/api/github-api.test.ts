import assert from "node:assert/strict"
import { afterEach, describe, test } from "node:test"
import { extractZipEntries, fetchRunLog } from "./logs.ts"
import { fetchPrData } from "./pr.ts"

const realFetch = globalThis.fetch
const realToken = process.env.GITHUB_TOKEN

afterEach(() => {
  globalThis.fetch = realFetch
  if (realToken === undefined) delete process.env.GITHUB_TOKEN
  else process.env.GITHUB_TOKEN = realToken
  delete process.env.GH_TOKEN
})

describe("GitHub direct API", () => {
  test("maps GraphQL pull request data into poll shapes", async () => {
    process.env.GITHUB_TOKEN = "test-token"
    globalThis.fetch = async () => new Response(JSON.stringify({
      data: {
        repository: {
          pullRequest: {
            state: "OPEN",
            mergeable: "CONFLICTING",
            mergeStateStatus: "DIRTY",
            reviews: {
              nodes: [{
                databaseId: 7,
                author: { login: "alice" },
                state: "CHANGES_REQUESTED",
                submittedAt: "2026-08-04T12:00:00Z",
                body: "Fix it",
              }],
            },
            statusCheckRollup: {
              contexts: {
                nodes: [{
                  name: "Lint",
                  conclusion: "failure",
                  detailsUrl: "https://github.com/org/repo/actions/runs/42",
                }],
              },
            },
          },
        },
      },
    }), { status: 200, headers: { "content-type": "application/json" } })

    const data = await fetchPrData("org/repo", 12)
    assert.deepEqual(data, {
      reviews: [{
        id: 7,
        author: { login: "alice" },
        state: "CHANGES_REQUESTED",
        submittedAt: "2026-08-04T12:00:00Z",
        body: "Fix it",
      }],
      statusCheckRollup: [{
        name: "Lint",
        conclusion: "failure",
        detailsUrl: "https://github.com/org/repo/actions/runs/42",
      }],
      mergeable: "CONFLICTING",
      mergeStateStatus: "DIRTY",
      state: "OPEN",
    })
  })

  test("returns undefined when the GraphQL response reports errors", async () => {
    process.env.GITHUB_TOKEN = "test-token"
    globalThis.fetch = async () => new Response(JSON.stringify({
      data: null,
      errors: [{ message: "boom" }],
    }), { status: 200, headers: { "content-type": "application/json" } })

    assert.equal(await fetchPrData("org/repo", 12), undefined)
  })

  test("extracts deflated entries from a GitHub run-log zip", async () => {
    process.env.GITHUB_TOKEN = "test-token"
    const zip = storedZip("1_build/1_setup.txt", "hello from the failing log\n")
    globalThis.fetch = async () => new Response(zip as BodyInit, {
      status: 200,
      headers: { "content-type": "application/zip", "content-length": String(zip.byteLength) },
    })

    const log = await fetchRunLog("org/repo", "42")
    assert.equal(log, "hello from the failing log\n")
  })

  test("skips run logs larger than the cap", async () => {
    process.env.GITHUB_TOKEN = "test-token"
    globalThis.fetch = async () => new Response(new Uint8Array(0), {
      status: 200,
      headers: { "content-type": "application/zip", "content-length": String(11_000_000) },
    })

    assert.equal(await fetchRunLog("org/repo", "42"), undefined)
  })
})

function storedZip(name: string, content: string): Uint8Array {
  const nameBytes = new TextEncoder().encode(name)
  const contentBytes = new TextEncoder().encode(content)
  const localHeader = new Uint8Array(30)
  const view = new DataView(localHeader.buffer)
  view.setUint32(0, 0x04034b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 0, true)
  view.setUint16(8, 0, true)
  view.setUint32(18, contentBytes.length, true)
  view.setUint32(22, contentBytes.length, true)
  view.setUint16(26, nameBytes.length, true)
  view.setUint16(28, 0, true)
  const local = concat(localHeader, nameBytes, contentBytes)

  const central = new Uint8Array(46)
  const centralView = new DataView(central.buffer)
  centralView.setUint32(0, 0x02014b50, true)
  centralView.setUint16(4, 20, true)
  centralView.setUint16(6, 20, true)
  centralView.setUint16(8, 0, true)
  centralView.setUint16(10, 0, true)
  centralView.setUint32(20, contentBytes.length, true)
  centralView.setUint32(24, contentBytes.length, true)
  centralView.setUint16(28, nameBytes.length, true)
  centralView.setUint16(30, 0, true)
  centralView.setUint16(32, 0, true)
  centralView.setUint32(42, 0, true)
  const centralEntry = concat(central, nameBytes)

  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)
  eocdView.setUint32(0, 0x06054b50, true)
  eocdView.setUint16(8, 1, true)
  eocdView.setUint16(10, 1, true)
  eocdView.setUint32(12, centralEntry.length, true)
  eocdView.setUint32(16, local.length, true)

  return concat(local, centralEntry, eocd)
}

function concat(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}
