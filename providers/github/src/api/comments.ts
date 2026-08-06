import { githubJson } from "./client.ts"

const MAX_COMMENT_PAGES = 10

export async function fetchGithubComments(path: string): Promise<any[] | undefined> {
  const comments: any[] = []
  for (let page = 1; page <= MAX_COMMENT_PAGES; page++) {
    const batch = await githubJson(`/${path}?per_page=100&page=${page}`)
    if (!Array.isArray(batch)) return undefined
    comments.push(...batch)
    if (batch.length < 100) return comments
  }
  return comments
}
