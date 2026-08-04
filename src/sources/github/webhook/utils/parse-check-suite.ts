import type { GithubEventShape } from "../types/event-shape.ts"
import type { GithubWebhookContext } from "../types/context.ts"

export function parseCheckSuite({ payload, repo, prNumber }: GithubWebhookContext): GithubEventShape {
  const conclusion = payload.check_suite?.conclusion ?? payload.check_suite?.status ?? "changed"
  return {
    kind: "ci",
    summary: `GitHub CI ${conclusion} on ${repo}#${prNumber}`,
    body: payload.check_suite?.latest_check_runs?.map((check: any) => check.name).join(", "),
    actionable: /FAIL|ERROR|CANCEL/i.test(String(conclusion)),
  }
}
