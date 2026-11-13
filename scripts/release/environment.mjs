import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import path from "node:path"
import { pathToFileURL } from "node:url"

/** Fail closed before GitHub can auto-create an unprotected release environment. */
export function assertReleaseEnvironment(environment, policies, owner) {
  assert.equal(environment.name, "release")
  const rule = environment.protection_rules?.find((entry) => entry.type === "required_reviewers")
  assert.equal(rule?.reviewers?.length, 1, "release must require its owner's approval")
  const reviewer = rule.reviewers[0]
  assert.equal(reviewer.type, "User")
  assert.equal(reviewer.reviewer.login.toLowerCase(), owner.toLowerCase())
  assert.deepEqual(environment.deployment_branch_policy, { protected_branches: false, custom_branch_policies: true })
  assert.equal(policies.total_count, 1, "release must allow only the v* tag policy")
  assert.equal(policies.branch_policies.length, 1)
  assert.equal(policies.branch_policies[0].type, "tag")
  assert.equal(policies.branch_policies[0].name, "v*")
}

/** Read only; authentication comes from the job's scoped GH_TOKEN. */
export function checkReleaseEnvironment(repository) {
  assert.match(repository ?? "", /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/)
  const route = "repos/" + repository + "/environments/release"
  const read = (endpoint) => JSON.parse(execFileSync("gh", ["api", endpoint], {
    encoding: "utf8", timeout: 15_000, maxBuffer: 1024 * 1024,
  }))
  const environment = read(route)
  const policies = read(route + "/deployment-branch-policies?per_page=100")
  assertReleaseEnvironment(environment, policies, repository.split("/")[0])
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  checkReleaseEnvironment(process.env.GITHUB_REPOSITORY)
  console.log("release environment requires owner approval and accepts only v* tags")
}
