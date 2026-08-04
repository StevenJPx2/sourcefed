export function jiraAuth(): string {
  const email = process.env.ATLASSIAN_EMAIL
  const key = process.env.ATLASSIAN_API_KEY
  if (!email || !key) throw new Error("ATLASSIAN_EMAIL / ATLASSIAN_API_KEY not set")
  return "Basic " + Buffer.from(`${email}:${key}`).toString("base64")
}
