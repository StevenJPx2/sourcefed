import { PollMonitor, mergeCursors } from "@sourcefed/core"
import { toMonitorEvent } from "@sourcefed/core"
import type { GithubSourceRecord } from "../types"
import { htmlToMarkdown } from "../utils/html-to-markdown.ts"
import { pollGithub } from "./utils"

export const githubPollMonitor = new PollMonitor<GithubSourceRecord>({
  run: async (source, cursor) => {
    const result = await pollGithub(source.repo, source.prNumber, cursor)
    return {
      cursor: result.cursor,
      events: result.events.map((event) => {
        const monitorEvent = toMonitorEvent(event, source)
        return { ...monitorEvent, body: htmlToMarkdown(monitorEvent.body) }
      }),
      terminal: result.terminal,
    }
  },
  mergeCursor: mergeCursors,
})
