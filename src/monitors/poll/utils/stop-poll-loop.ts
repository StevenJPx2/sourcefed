import { setTimer } from "./set-timer.ts"
import { pollLoopState } from "./state.ts"

export function stopPollLoop(): void {
  if (pollLoopState.timer) clearInterval(pollLoopState.timer)
  setTimer(undefined)
}
