import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { STATE_DIR } from "../../utils"
import { openPollLock } from "./open-poll-lock.ts"
import { reclaimPollLock } from "./reclaim-poll-lock.ts"

export async function withPollLock<T>(monitorId: string, operation: () => Promise<T>): Promise<T | undefined> {
  const lockDirectory = path.join(STATE_DIR, "poll-locks")
  await mkdir(lockDirectory, { recursive: true })

  const lockPath = path.join(lockDirectory, `${monitorId}.lock`)
  let lockFile = await openPollLock(lockPath)
  if (!lockFile) lockFile = await reclaimPollLock(lockPath)
  if (!lockFile) return undefined

  try {
    return await operation()
  } finally {
    await lockFile.close()
    await rm(lockPath, { force: true }).catch(() => {})
  }
}
