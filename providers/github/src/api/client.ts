const API = "https://api.github.com"
const GRAPHQL = "https://api.github.com/graphql"

export function githubToken(): string | undefined {
  return process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
}

export async function githubJson(path: string): Promise<any | undefined> {
  const token = githubToken()
  if (!token) return undefined
  try {
    const response = await fetch(`${API}${path}`, {
      headers: { authorization: `Bearer ${token}`, "user-agent": "sourcefed", accept: "application/vnd.github+json" },
    })
    if (!response.ok) return undefined
    return (await response.json()) as any
  } catch {
    return undefined
  }
}

export async function githubGraphQL(query: string, variables: Record<string, unknown>): Promise<any | undefined> {
  const token = githubToken()
  if (!token) return undefined
  try {
    const response = await fetch(GRAPHQL, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "user-agent": "sourcefed", "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    })
    const body = (await response.json()) as { errors?: unknown; data?: unknown }
    if (!response.ok || body.errors) return undefined
    return body.data
  } catch {
    return undefined
  }
}
