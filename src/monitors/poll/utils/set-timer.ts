import { pollLoopState } from "./state.ts"

export function setTimer(value: ReturnType<typeof setInterval> | undefined): void {
  pollLoopState.timer = value
}
