#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const VERSION = process.argv[2] ?? JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version
const DOTFILES = process.env.DOTFILES_DIR ?? path.join(os.homedir(), "Documents/Projects/dotfiles")
const TAP = process.env.TAP_DIR ?? path.join(os.homedir(), "Documents/Projects/homebrew-sourcefed")

// 1. dotfiles: opencode.jsonc + tui.json plugin pins
if (existsSync(path.join(DOTFILES, "configs/opencode/opencode.jsonc"))) {
  for (const file of ["configs/opencode/opencode.jsonc", "configs/opencode/tui.json"]) {
    const full = path.join(DOTFILES, file)
    writeFileSync(full, readFileSync(full, "utf8").replace(/@fdcn\/sourcefed@[\d.]+/g, `@fdcn/sourcefed@${VERSION}`))
  }
  run("git", ["add", "configs/opencode"], DOTFILES)
  run("git", ["commit", "-m", `chore(opencode): bump sourcefed plugin to ${VERSION}`], DOTFILES)
  run("git", ["push", "origin", "HEAD"], DOTFILES)
} else {
  console.warn(`[pins] dotfiles repo not found at ${DOTFILES}; skipped`)
}

// 2. pi settings
try {
  run("pi", ["install", `npm:@fdcn/sourcefed@${VERSION}`], ROOT)
} catch {
  console.warn("[pins] pi not on PATH; skipped")
}

// 3. homebrew tap formula
if (existsSync(TAP)) {
  run("git", ["pull", "--rebase", "-q", "origin", "HEAD"], TAP)
  const formula = path.join(TAP, "Formula/sourcefed.rb")
  const sha = createHash("sha256").update(execFileSync("curl", ["-sL", `https://registry.npmjs.org/@fdcn/sourcefed/-/sourcefed-${VERSION}.tgz`])).digest("hex")
  writeFileSync(
    formula,
    readFileSync(formula, "utf8")
      .replace(/sourcefed-[\d.]+\.tgz/g, `sourcefed-${VERSION}.tgz`)
      .replace(/sha256 "[a-f0-9]{64}"/, `sha256 "${sha}"`),
  )
  run("git", ["add", "Formula"], TAP)
  run("git", ["commit", "-m", `sourcefed: update to ${VERSION}`], TAP)
  run("git", ["push", "origin", "HEAD"], TAP)
} else {
  console.warn(`[pins] tap repo not found at ${TAP}; skipped`)
}

console.log(`\nupdated deployment pins to @fdcn/sourcefed@${VERSION}: dotfiles, pi, homebrew`)

function run(command, args, cwd) {
  console.log(`$ ${command} ${args.join(" ")}`)
  execFileSync(command, args, { cwd, stdio: "inherit" })
}
