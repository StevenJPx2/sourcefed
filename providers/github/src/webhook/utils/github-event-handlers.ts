import type { GithubEventHandler } from "../types"
import { parseCheckRun } from "./parse-check-run.ts"
import { parseCheckSuite } from "./parse-check-suite.ts"
import { parseGithubComment } from "./parse-github-comment.ts"
import { parsePullRequest } from "./parse-pull-request.ts"
import { parsePullRequestReview } from "./parse-pull-request-review.ts"

export const githubEventHandlers: Record<string, GithubEventHandler> = {
  pull_request_review: parsePullRequestReview,
  pull_request_review_comment: parseGithubComment,
  issue_comment: parseGithubComment,
  check_run: parseCheckRun,
  check_suite: parseCheckSuite,
  pull_request: parsePullRequest,
}
