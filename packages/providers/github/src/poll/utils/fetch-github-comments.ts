import { sh } from "./sh.ts"

export function fetchGithubComments(path: string): any[] | undefined {
  const response = sh(["api", path, "--paginate"])
  if (response.code !== 0) return undefined
  try {
    const parsed = JSON.parse(response.out)
    if (Array.isArray(parsed)) return parsed
  } catch {
    return undefined
  }
  return undefined
}
