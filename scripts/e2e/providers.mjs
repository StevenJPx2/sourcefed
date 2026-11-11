import { scenario } from "./scenarios.mjs"

export async function providerPollGate(context) {
  const result = []
  for (const name of ["jira", "github", "slack", "yab"]) {
    result.push(await scenario(context, `provider-${name}.test.mjs`))
  }
  return { fixtures: result, jira: "poll-only provider; no Jira webhook API is implemented" }
}
