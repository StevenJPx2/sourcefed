export function githubPullRequestNumber(payload: any, eventName: string): number | undefined {
  let value = payload.pull_request?.number
  if (value === undefined) value = payload.issue?.number
  if (value === undefined && eventName === "check_run") value = payload.check_run?.pull_requests?.[0]?.number
  if (value === undefined && eventName === "check_suite") value = payload.check_suite?.pull_requests?.[0]?.number
  if (value === undefined) return undefined

  const number = Number(value)
  if (!Number.isInteger(number)) return undefined
  return number
}
