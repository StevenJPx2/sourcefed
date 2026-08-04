export function formatFailedCheck(check: any): string {
  let name = check.name
  if (!name) name = check.context
  if (!name) name = "check"
  let conclusion = check.conclusion
  if (!conclusion) conclusion = check.state
  if (!conclusion) conclusion = "FAILURE"
  return `- ${name}: ${conclusion}`
}
