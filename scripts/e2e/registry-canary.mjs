import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { Blocked, command, environment, evidence } from "./harness.mjs"
import { piGate } from "./pi.mjs"

export async function registryGate(context) {
  const env = await environment(path.join(context.work, "registry"))
  let lookup
  try {
    lookup = await command("npm", ["view",
    `@fdcn/sourcefed@${context.version}`, "version", "dist.integrity", "dist-tags.latest", "--json",
    ], { cwd: context.root, env, timeout: 30_000 })
  } catch (error) {
    if (/E404/.test(String(error))) throw new Blocked(`registry ${context.version} is unpublished; this is a post-publish gate`)
    throw error
  }
  const metadata = JSON.parse(lookup.stdout)
  if (metadata["dist.integrity"] !== context.integrity) {
    throw new Blocked(`registry ${context.version} does not contain this exact artifact; registry verification is post-publish`)
  }
  assert.equal(metadata.version, context.version)
  assert.equal(metadata["dist-tags.latest"], context.version)
  const consumer = path.join(context.work, "registry-consumer")
  await mkdir(consumer, { recursive: true })
  await writeFile(path.join(consumer, "package.json"), JSON.stringify({ private: true, type: "module" }))
  await command("npm", ["install", `@fdcn/sourcefed@${context.version}`, "--ignore-scripts", "--no-audit"], { cwd: consumer, env })
  const installed = path.join(consumer, "node_modules/@fdcn/sourcefed")
  await command(path.join(consumer, "node_modules/.bin/sourcefed"), ["skills", "list"], { cwd: consumer, env })
  const hosts = await piGate({ ...context, consumer, packageDir: installed }, true)
  const visual = await evidence(context, context.options["registry-proof"], "registry-hosts", [
    "opencode-auto-install", "opencode-server", "opencode-tui", "pi-registry-install",
  ])
  return { integrity: metadata["dist.integrity"], hosts, visual }
}
