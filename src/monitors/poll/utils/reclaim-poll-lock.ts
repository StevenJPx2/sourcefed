import { open, rm, stat } from "node:fs/promises"

const POLL_LOCK_STALE_MS = 5 * 60 * 1000

export async function reclaimPollLock(lockPath: string) {
  let lockStats
  try {
    lockStats = await stat(lockPath)
  } catch {
    return undefined
  }

  const lockAgeMs = Date.now() - lockStats.mtimeMs
  if (lockAgeMs <= POLL_LOCK_STALE_MS) return undefined

  try {
    await rm(lockPath)
    return await open(lockPath, "wx")
  } catch {
    return undefined
  }
}
