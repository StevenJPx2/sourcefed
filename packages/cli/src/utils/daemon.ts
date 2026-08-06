import { SourcefedDaemon } from "@sourcefed/daemon"

export function createDaemon(): SourcefedDaemon {
  return new SourcefedDaemon({
    stateDir: process.env.SOURCEFED_STATE_DIR,
  })
}
