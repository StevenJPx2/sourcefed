export function parseGithubData(raw: string): any | undefined {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}
