import { open } from "node:fs/promises"

export async function openPollLock(lockPath: string) {
  try {
    return await open(lockPath, "wx")
  } catch (error) {
    let errorCode: string | undefined
    if (error instanceof Error && "code" in error) {
      const candidate = error.code
      if (typeof candidate === "string") errorCode = candidate
    }
    if (errorCode !== "EEXIST") throw error
    return undefined
  }
}
