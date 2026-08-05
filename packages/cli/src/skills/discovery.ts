import { statSync } from "node:fs"
import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseFrontmatter } from "./frontmatter.ts"

export type SkillInfo = {
  name: string
  description: string
  dir: string
  hidden: boolean
}

const SKILL_DIRS = ["data"]

async function skillsDirs(): Promise<string[]> {
  const override = process.env.SOURCEFED_SKILLS_DIR
  if (override) {
    try {
      return (await stat(override)).isDirectory() ? [override] : []
    } catch {
      return []
    }
  }
  const directories: string[] = []
  for (const name of SKILL_DIRS) {
    const candidate = path.join(skillRoot(), name)
    try {
      if ((await stat(candidate)).isDirectory()) directories.push(candidate)
    } catch {
      // directory not present
    }
  }
  return directories
}

export async function discoverSkills(): Promise<SkillInfo[]> {
  const skills: SkillInfo[] = []
  for (const dir of await skillsDirs()) {
    for (const entry of await readdir(dir)) {
      const skillDir = path.join(dir, entry)
      let entryStat
      try {
        entryStat = await stat(skillDir)
      } catch {
        continue
      }
      if (!entryStat.isDirectory()) continue
      const skillFile = path.join(skillDir, "SKILL.md")
      try {
        const content = await readFile(skillFile, "utf8")
        const parsed = parseFrontmatter(content)
        if (parsed) skills.push({ name: parsed.name, description: parsed.description, dir: skillDir, hidden: parsed.hidden })
      } catch {
        // no SKILL.md in this directory
      }
    }
  }
  skills.sort((left, right) => left.name.localeCompare(right.name))
  return skills
}

function skillRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url))
  for (let depth = 0; depth < 6; depth++) {
    const marker = path.join(dir, "data")
    if (statSync(marker, { throwIfNoEntry: false })?.isDirectory()) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.dirname(fileURLToPath(import.meta.url))
}
