import { PollMonitor } from "@sourcefed/core"
import { toMonitorEvent } from "@sourcefed/core"
import type { YabSourceRecord } from "../types"
import { pollYab } from "./utils"

export const yabPollMonitor = new PollMonitor<YabSourceRecord>({
  run: async (source, cursor) => {
    const result = await pollYab(source, cursor)
    return {
      cursor: result.cursor,
      events: result.events.map((event) => toMonitorEvent(event, source)),
      terminal: result.terminal,
    }
  },
})
