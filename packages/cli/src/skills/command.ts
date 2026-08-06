import { readFile, readdir, stat } from "node:fs/promises"
import path from "node:path"
import { discoverSkills } from "./discovery.ts"

export async function runSkillsCommand(args: string[]): Promise<void> {
  const subcommand = args[0] ?? "list"
  if (subcommand === "list") {
    await runList()
    return
  }
  if (subcommand === "get") {
    await runGet(args.slice(1))
    return
  }
  if (subcommand === "path") {
    await runPath(args[1])
    return
  }
  throw new Error(`unknown skills subcommand ${subcommand}`)
}

async function runList(): Promise<void> {
  const skills = (await discoverSkills()).filter((skill) => !skill.hidden)
  if (skills.length === 0) {
    console.error("no skills found; set SOURCEFED_SKILLS_DIR or reinstall")
    process.exitCode = 1
    return
  }
  for (const skill of skills) {
    console.log(`${skill.name}: ${skill.description}`)
  }
}

async function runGet(args: string[]): Promise<void> {
  const full = args.includes("--full")
  const all = args.includes("--all")
  const names = args.filter((arg) => arg !== "--full" && arg !== "--all")
  const skills = await discoverSkills()

  const selected = all ? skills.filter((skill) => !skill.hidden) : skills.filter((skill) => names.includes(skill.name))
  if (selected.length === 0) {
    console.error(`skill not found: ${names.join(", ") || "(none)"}`)
    process.exitCode = 1
    return
  }

  let output = ""
  for (const skill of selected) {
    output += `# ${skill.name}\n\n`
    output += await readFile(path.join(skill.dir, "SKILL.md"), "utf8")
    output += "\n"
    if (full) output += await supplementaryFiles(skill.dir)
  }
  process.stdout.write(output)
}

async function runPath(name?: string): Promise<void> {
  const skills = await discoverSkills()
  if (!name) {
    for (const skill of skills) console.log(skill.dir)
    return
  }
  const skill = skills.find((entry) => entry.name === name)
  if (!skill) {
    console.error(`skill not found: ${name}`)
    process.exitCode = 1
    return
  }
  console.log(skill.dir)
}

async function supplementaryFiles(skillDir: string): Promise<string> {
  let output = ""
  for (const subdirName of ["references", "templates"]) {
    const subdir = path.join(skillDir, subdirName)
    try {
      if (!(await stat(subdir)).isDirectory()) continue
    } catch {
      continue
    }
    const entries = (await readdir(subdir)).sort()
    for (const entry of entries) {
      const filePath = path.join(subdir, entry)
      try {
        if (!(await stat(filePath)).isFile()) continue
      } catch {
        continue
      }
      const content = await readFile(filePath, "utf8")
      output += `## ${subdirName}/${entry}\n\n${content}\n\n`
    }
  }
  return output
}
