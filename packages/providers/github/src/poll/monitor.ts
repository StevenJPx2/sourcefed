import { PollMonitor } from "@sourcefed/core"
import { toMonitorEvent } from "@sourcefed/core"
import type { GithubSourceRecord } from "../types"
import { pollGithub } from "./utils"

export const githubPollMonitor = new PollMonitor<GithubSourceRecord>({
  run: async (source, cursor) => {
    const result = pollGithub(source.repo, source.prNumber, cursor)
    return {
      cursor: result.cursor,
      events: result.events.map((event) => toMonitorEvent(event, source)),
      terminal: result.terminal,
    }
  },
})
