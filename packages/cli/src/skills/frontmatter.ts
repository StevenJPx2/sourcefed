export function parseFrontmatter(content: string): { name: string; description: string; hidden: boolean } | undefined {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith("---")) return undefined
  const afterOpening = trimmed.slice(3)
  const end = afterOpening.indexOf("\n---")
  if (end < 0) return undefined
  const frontmatter = afterOpening.slice(0, end)

  let name: string | undefined
  let description = ""
  let hidden = false
  const lines = frontmatter.split("\n")
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (line.startsWith("name:")) {
      name = line.slice(5).trim()
    } else if (line.startsWith("description:")) {
      let value = line.slice(12).trim()
      while (index + 1 < lines.length && (lines[index + 1].startsWith("  ") || lines[index + 1].startsWith("\t"))) {
        index += 1
        value += ` ${lines[index].trim()}`
      }
      description = value
    } else if (line.startsWith("hidden:")) {
      hidden = ["true", "yes"].includes(line.slice(7).trim())
    }
    index += 1
  }
  return name ? { name, description, hidden } : undefined
}
