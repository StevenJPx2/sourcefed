import type { GithubEventShape } from "../types/event-shape.ts"
import type { GithubWebhookContext } from "../types/context.ts"

export function parseCheckRun({ payload, repo, prNumber }: GithubWebhookContext): GithubEventShape {
  const conclusion = payload.check_run?.conclusion ?? payload.check_run?.status ?? "changed"
  return {
    kind: "ci",
    summary: `GitHub CI ${conclusion} on ${repo}#${prNumber}`,
    body: payload.check_run?.output?.text ?? payload.check_run?.name,
    actionable: /FAIL|ERROR|CANCEL/i.test(String(conclusion)),
  }
}
