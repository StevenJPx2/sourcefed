import { setTimer } from "./set-timer.ts"
import { pollLoopState } from "./state.ts"
import { tick } from "./tick.ts"
import type { Client } from "#sourcefed/types"

const LOOP_SEC = 5

export function ensurePollLoop(client: Client): void {
  if (pollLoopState.timer) return
  const nextTimer = setInterval(() => {
    tick(client).catch((err) => console.error("[sourcefed] monitor tick error:", err))
  }, LOOP_SEC * 1000)
  setTimer(nextTimer)
  tick(client).catch(() => {})
}
