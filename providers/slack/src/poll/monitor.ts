import { PollMonitor } from "@sourcefed/core"
import { toMonitorEvent } from "@sourcefed/core"
import type { SlackSourceRecord } from "../types"
import { pollSlack } from "./utils"

export const slackPollMonitor = new PollMonitor<SlackSourceRecord>({
  run: async (source, cursor) => {
    const result = await pollSlack(source, cursor)
    return {
      cursor: result.cursor,
      events: result.events.map((event) => toMonitorEvent(event, source)),
      terminal: result.terminal,
    }
  },
})
