import { assert, assertEqual, removeDir, tempDir } from "./harness.mjs"

process.env.SOURCEFED_GITHUB_WEBHOOK_SECRET = ""
process.env.SOURCEFED_SLACK_SIGNING_SECRET = ""
process.env.GITHUB_TOKEN = "it-test-token"
const { SourcefedDaemon } = await import("@sourcefed/daemon")

let graphqlCalls = 0
let commentCalls = 0
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  const href = String(url)
  if (href.startsWith("https://api.github.com/graphql")) {
    graphqlCalls += 1
    const second = graphqlCalls >= 2
    return new Response(JSON.stringify({
      data: {
        repository: {
          pullRequest: {
            state: "OPEN",
            mergeable: "MERGABLE",
            mergeStateStatus: "CLEAN",
            reviews: {
              nodes: [{
                databaseId: 7,
                author: { login: "alice" },
                state: "CHANGES_REQUESTED",
                submittedAt: "2026-08-05T00:01:00.000Z",
                body: "Please fix the assertion",
              }].concat(second ? [{
                databaseId: 8,
                author: { login: "bob" },
                state: "APPROVED",
                submittedAt: "2026-08-05T00:04:00.000Z",
                body: "LGTM",
              }] : []),
              pageInfo: { hasNextPage: false, endCursor: null },
            },
            statusCheckRollup: {
              contexts: {
                nodes: [{ name: "Lint", conclusion: "success", detailsUrl: "https://github.com/org/repo/actions/runs/1" }],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
      },
    }), { status: 200, headers: { "content-type": "application/json" } })
  }
  if (href.includes("/repos/org/repo/pulls/12/comments")) {
    commentCalls += 1
    const comments = [{
      id: 11,
      user: { login: "bob" },
      path: "src/app.ts",
      line: 3,
      body: "inline note",
      created_at: "2026-08-05T00:02:00.000Z",
    }]
    if (commentCalls >= 2) comments.push({
      id: 13,
      user: { login: "dave" },
      path: "src/app.ts",
      line: 5,
      body: "new inline note",
      created_at: "2026-08-05T00:05:00.000Z",
    })
    return new Response(JSON.stringify(comments), { status: 200, headers: { "content-type": "application/json" } })
  }
  if (href.includes("/repos/org/repo/issues/12/comments")) {
    return new Response(JSON.stringify([{
      id: 12,
      user: { login: "carol" },
      body: "conversation note",
      created_at: "2026-08-05T00:03:00.000Z",
    }]), { status: 200, headers: { "content-type": "application/json" } })
  }
  return new Response(JSON.stringify({ message: "unexpected" }), { status: 404 })
}

const dir = await tempDir("sourcefed-it-github-")
const daemon = new SourcefedDaemon({ stateDir: dir })
try {
  await daemon.start()
  const target = { kind: "it", id: "github-1" }
  const created = await daemon.createMonitor(target, { name: "org/repo#12", sourceType: "github", repo: "org/repo", prNumber: 12 })
  assert(created.ok, "create github monitor")

  const received = []
  daemon.subscribe(target, async (events) => { received.push(...events) })
  await daemon.runtime.tick()
  const polled = await daemon.service.get(created.monitor.id)
  await daemon.service.updateCursor(polled, "__lastPolledAt", 0)
  await daemon.runtime.tick()
  await daemon.runtime.tick()

  assertEqual(received.length, 2, "new review + new line comment after priming tick")
  const kinds = received.map((entry) => entry.event.kind).sort()
  assert(kinds.filter((kind) => kind === "review").length === 1, "one new review")
  assert(kinds.includes("comment"), `kinds: ${kinds.join(",")}`)
  const review = received.find((entry) => entry.event.kind === "review")
  assertEqual(review.event.summary, "Review by bob [APPROVED] on #12")
  const comment = received.find((entry) => entry.event.kind === "comment" && entry.event.body.includes("new inline note"))
  assert(comment, "new line comment emitted")
  assert(graphqlCalls >= 2, `graphql called (${graphqlCalls})`)

  await daemon.stop()
  console.log("provider-github: mocked GraphQL/REST through daemon tick — ok")
} finally {
  await daemon.stop().catch(() => {})
  globalThis.fetch = realFetch
  await removeDir(dir)
}
