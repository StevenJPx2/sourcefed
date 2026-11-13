import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { Blocked, command, contentDigest, digest, environment, evidence } from "./harness.mjs"
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
  // The Release workflow packs on CI, whose gzip differs from this Mac's, so the
  // registry may hold the verified entries in other compressed bytes.
  let repacked
  if (metadata["dist.integrity"] !== context.integrity) {
    repacked = await samePackage(context, env, metadata["dist.integrity"])
    if (!repacked) throw new Blocked(`registry ${context.version} does not contain this exact artifact; registry verification is post-publish`)
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
  return { integrity: metadata["dist.integrity"], hosts, visual, ...(repacked ? { repacked } : {}) }
}

/**
 * The registry tarball, when its uncompressed tar is the verified artifact's: its
 * path, sha256 and integrity, for Homebrew and the tap to use. Undefined otherwise.
 */
async function samePackage(context, env, integrity) {
  const directory = path.join(context.work, "registry-tarball")
  await mkdir(directory, { recursive: true })
  const packed = JSON.parse((await command("npm", ["pack", `@fdcn/sourcefed@${context.version}`, "--json", "--pack-destination", directory],
    { cwd: directory, env, timeout: 60_000 })).stdout)
  const artifact = path.join(directory, packed[0].filename)
  assert.equal(packed[0].integrity, integrity, "npm pack fetched the registry tarball")
  if (await contentDigest(artifact) !== await contentDigest(context.artifact)) return undefined
  return { artifact, sha256: await digest(artifact), integrity, contentSha256: await contentDigest(artifact) }
}
