import { describe, expect, test } from "bun:test"
import { parseGithubWebhook } from "./sources/github/webhook"
import { githubPullRequestNumber } from "./sources/github/webhook/utils/pull-request-number.ts"

describe("GitHub webhook events", () => {
  test("extracts pull request numbers from check payloads", () => {
    expect(githubPullRequestNumber({ check_run: { pull_requests: [{ number: 1671 }] } }, "check_run")).toBe(1671)
    expect(githubPullRequestNumber({ check_suite: { pull_requests: [{ number: 1671 }] } }, "check_suite")).toBe(1671)
  })

  test("routes check-run events through their pull request association", () => {
    const event = parseGithubWebhook({
      action: "completed",
      repository: { full_name: "example-org/example-repo", updated_at: "2026-08-04T12:00:00.000Z" },
      check_run: {
        name: "Lint",
        conclusion: "failure",
        pull_requests: [{ number: 1671 }],
      },
      sender: { login: "github-actions[bot]" },
    }, "check_run", "delivery-1")

    expect(event).toMatchObject({
      source: { type: "github", repo: "example-org/example-repo", prNumber: 1671 },
      kind: "ci",
      actionable: true,
    })
  })

  test("routes check-suite events through their pull request association", () => {
    const event = parseGithubWebhook({
      action: "completed",
      repository: { full_name: "example-org/example-repo" },
      check_suite: {
        conclusion: "success",
        pull_requests: [{ number: 1671 }],
      },
      sender: { login: "github-actions[bot]" },
    }, "check_suite", "delivery-2")

    expect(event).toMatchObject({
      source: { type: "github", repo: "example-org/example-repo", prNumber: 1671 },
      kind: "ci",
      actionable: false,
    })
  })

  test("treats a closed unmerged pull request as terminal", () => {
    const event = parseGithubWebhook({
      action: "closed",
      repository: { full_name: "example-org/example-repo" },
      pull_request: { number: 1671, merged: false },
      sender: { login: "someone" },
    }, "pull_request", "delivery-3")

    expect(event).toMatchObject({
      kind: "closed",
      id: "pr:CLOSED",
      terminal: true,
    })
  })

  test("ignores automated pull request edits", () => {
    const event = parseGithubWebhook({
      action: "edited",
      repository: { full_name: "example-org/example-repo" },
      pull_request: { number: 1678 },
      sender: { login: "github-actions[bot]" },
    }, "pull_request", "delivery-4")

    expect(event).toBeUndefined()
  })

  test("ignores empty pull request reviews", () => {
    const event = parseGithubWebhook({
      action: "submitted",
      repository: { full_name: "example-org/example-repo" },
      pull_request: { number: 1678 },
      review: { id: 42, state: "commented", body: "" },
      sender: { login: "claude[bot]" },
    }, "pull_request_review", "delivery-5")

    expect(event).toBeUndefined()
  })

  test("keeps review content without delivery metadata", () => {
    const event = parseGithubWebhook({
      action: "submitted",
      repository: { full_name: "example-org/example-repo" },
      pull_request: { number: 1678 },
      review: { id: 43, state: "commented", body: "Please update the assertion." },
      sender: { login: "claude[bot]" },
    }, "pull_request_review", "delivery-6")

    expect(event).toMatchObject({
      body: "Please update the assertion.",
    })
    expect(event?.body).not.toContain("Webhook delivery")
  })
})
