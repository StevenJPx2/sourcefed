import { PollMonitor } from "@sourcefed/core"
import { toMonitorEvent } from "@sourcefed/core"
import type { JiraSourceRecord } from "../types"
import { pollJira } from "./utils"

export const jiraPollMonitor = new PollMonitor<JiraSourceRecord>({
  run: async (source, cursor) => {
    const result = await pollJira(source.issueKey, cursor)
    return {
      cursor: result.cursor,
      events: result.events.map((event) => toMonitorEvent(event, source)),
      terminal: result.terminal,
    }
  },
})
