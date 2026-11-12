import assert from "node:assert/strict"
import { afterEach, describe, test } from "node:test"
import { ciFailureDetail } from "./ci-failure-detail.ts"
import { RECORDED_FAILURES, type RecordedJob, type RecordedRun } from "./fixtures/recorded-ci-runs.ts"

const realFetch = globalThis.fetch
const realToken = process.env.GITHUB_TOKEN

afterEach(() => {
  globalThis.fetch = realFetch
  if (realToken === undefined) delete process.env.GITHUB_TOKEN
  else process.env.GITHUB_TOKEN = realToken
})

describe("CI failure detail", () => {
  for (const recorded of RECORDED_FAILURES) {
    test(`quotes only the failed jobs of recorded PR #${recorded.pr}`, async () => {
      serveGithubLogs(recorded.runs)
      const jobs = recorded.runs.flatMap((run) => run.jobs)
      const body = await ciFailureDetail("org/repo", failedChecks(jobs))

      for (const job of jobs) {
        const quoted = body.includes(lastLine(job))
        assert.equal(quoted, job.conclusion === "failure", `${job.name} (${job.conclusion}) quoted: ${quoted}`)
      }
      for (const name of recorded.failedJobs) assert.match(body, new RegExp(`### Failing log: ${escape(name)}\n`))
    })
  }

  test("lists every failed job and quotes the first three", async () => {
    const run = RECORDED_FAILURES[1]!.runs[1]!
    const jobs = run.jobs.map((job, index) => ({ ...job, conclusion: index < 4 ? "failure" : "success" }))
    serveGithubLogs([{ ...run, jobs }])
    const body = await ciFailureDetail("org/repo", failedChecks(jobs))

    const failed = jobs.slice(0, 4)
    for (const job of failed) assert.match(body, new RegExp(`^- ${escape(job.name)}: FAILURE$`, "m"))
    assert.deepEqual(failed.map((job) => body.includes(lastLine(job))), [true, true, true, false])
  })
})

function failedChecks(jobs: RecordedJob[]): any[] {
  return jobs
    .map((job) => ({ name: job.name, conclusion: job.conclusion.toUpperCase(), detailsUrl: job.url }))
    .filter((check) => /FAIL|ERROR|CANCEL/i.test(check.conclusion))
}

function jobLog(job: RecordedJob): string {
  const lines = Array.from({ length: 80 }, (_, index) => `2026-11-12T07:15:${String(index % 60).padStart(2, "0")}.0000000Z ${job.name} step ${index}`)
  return [...lines, `2026-11-12T07:16:00.0000000Z ${lastLine(job)}`].join("\n") + "\n"
}

function lastLine(job: RecordedJob): string {
  return `job ${job.databaseId} ended here`
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Serves both of GitHub's log endpoints: per-job plain text, and the whole run as a zip whose entries
// follow the recorded archive order.
function serveGithubLogs(runs: RecordedRun[]): void {
  process.env.GITHUB_TOKEN = "test-token"
  const jobs = new Map(runs.flatMap((run) => run.jobs.map((job) => [String(job.databaseId), job] as const)))
  globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input)
    const jobId = url.match(/\/repos\/org\/repo\/actions\/jobs\/(\d+)\/logs$/)?.[1]
    const job = jobId === undefined ? undefined : jobs.get(jobId)
    if (job) return new Response(jobLog(job), { status: 200, headers: { "content-type": "text/plain" } })
    const runId = url.match(/\/repos\/org\/repo\/actions\/runs\/(\d+)\/logs$/)?.[1]
    const run = runs.find((candidate) => String(candidate.id) === runId)
    if (run) return new Response(runArchive(run) as BodyInit, { status: 200, headers: { "content-type": "application/zip" } })
    return new Response("not found", { status: 404 })
  }
}

function runArchive(run: RecordedRun): Uint8Array {
  const entries = run.archive.flatMap((name, index) => {
    const job = run.jobs.find((candidate) => candidate.name === name)
    const file = name.replace(/\//g, "_")
    return [
      { name: `${index}_${file}.txt`, content: job ? jobLog(job) : "" },
      { name: `${file}/system.txt`, content: "Requested labels: ubuntu-latest\n" },
    ]
  })
  return storedZip(entries)
}

function storedZip(entries: { name: string; content: string }[]): Uint8Array {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const content = encoder.encode(entry.content)
    const local = new Uint8Array(30)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint32(18, content.length, true)
    localView.setUint32(22, content.length, true)
    localView.setUint16(26, name.length, true)
    const central = new Uint8Array(46)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint32(20, content.length, true)
    centralView.setUint32(24, content.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint32(42, offset, true)
    locals.push(local, name, content)
    centrals.push(central, name)
    offset += local.length + name.length + content.length
  }
  const centralSize = centrals.reduce((sum, chunk) => sum + chunk.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, entries.length, true)
  endView.setUint16(10, entries.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)
  return concat([...locals, ...centrals, end])
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}
