#!/usr/bin/env node
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { environment } from "../e2e/harness.mjs"
import { registryGate } from "../e2e/registry-canary.mjs"
import { assertPublishable } from "./artifact.mjs"
import { options, root, sourceState } from "./verify.mjs"

export async function verifyRegistry(record, settings) {
  const work = await mkdtemp(path.join(os.tmpdir(), "sourcefed-registry-"))
  const env = await environment(path.join(work, "isolation"))
  try {
    await assertPublishable(record, await sourceState(env), record.version)
    const detail = await registryGate({ ...record, root, work, env, options: settings })
    if (detail.repacked) adoptRegistryTarball(record, detail, await keep(detail.repacked.artifact, record.version))
    record.results = record.results.filter((gate) => gate.name !== "registry")
    record.results.push({ name: "registry", phase: "postpublish", status: "pass", detail })
    record.registryVerified = true
    await writeFile(path.join(root, ".release/manifest.json"), JSON.stringify(record, null, 2) + "\n")
    return detail
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

/**
 * The registry holds the verified entries in other gzip bytes: Homebrew and the tap
 * use the registry's, so the record now names them, keeping the verified ones.
 */
export function adoptRegistryTarball(record, detail, artifact) {
  const { sha256, integrity, contentSha256 } = detail.repacked
  record.verifiedArtifact = { artifact: record.artifact, sha256: record.sha256, integrity: record.integrity, contentSha256 }
  Object.assign(record, { artifact, sha256, integrity })
  detail.repacked = { ...detail.repacked, artifact }
}

async function keep(file, version) {
  const kept = path.join(root, ".release", `registry-sourcefed-${version}.tgz`)
  await copyFile(file, kept)
  return kept
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const record = JSON.parse(await readFile(path.join(root, ".release/manifest.json"), "utf8"))
  console.log(JSON.stringify(await verifyRegistry(record, options(process.argv.slice(2))), null, 2))
}
