import { Monitor } from "@sourcefed/core"
import type { MonitorCreateInput } from "@sourcefed/core"
import type { YabSourceRecord } from "./types"
import type { SourceInput } from "@sourcefed/core"
import { YabSourceSchema } from "./schema.ts"
import { yabPollMonitor } from "./poll"

export class YabMonitor extends Monitor<YabSourceRecord> {
  readonly poll = yabPollMonitor

  constructor() {
    super({ type: "yab", schema: YabSourceSchema })
  }

  readonly key = (source: YabSourceRecord): string => `yab:${source.space ?? ""}:${source.url}`
  readonly input = {
    description: "New entries of an Atom, RSS or JSON feed read through the user's Yab browser with their sign-ins; Yab must be running",
    properties: {
      url: { type: "string", description: "Feed URL, e.g. https://mail.google.com/mail/u/0/feed/atom" },
      space: { type: "string", description: "Yab space whose sign-ins to use; omit to use wherever the site is signed in" },
      match: { type: "string", description: "Case-insensitive regex; only entries whose title, summary or author match are delivered" },
      exclude: { type: "string", description: "Case-insensitive regex; entries that match are skipped" },
    },
    required: ["url"],
  }
  readonly icon = "󰖟"
  readonly label = (source: YabSourceRecord): string => new URL(source.url).hostname
  readonly detail = (source: YabSourceRecord): string =>
    ` ${shortUrl(source.url)}${source.match || source.exclude ? " · filtered" : ""}`
  readonly describe = (source: YabSourceRecord): string =>
    `Yab feed ${shortUrl(source.url)}${source.space ? ` (${source.space})` : ""}`

  build(input: MonitorCreateInput): SourceInput {
    if (!input.url) return { error: "url is required for a yab monitor" }

    let url: URL
    try {
      url = new URL(input.url)
    } catch {
      return { error: "url must be a valid http(s) URL" }
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return { error: "url must be a valid http(s) URL" }

    for (const [key, pattern] of [["match", input.match], ["exclude", input.exclude]] as const) {
      if (!pattern) continue
      try {
        new RegExp(pattern, "i")
      } catch {
        return { error: `${key} must be a valid regular expression` }
      }
    }

    const source: YabSourceRecord = { type: "yab", url: url.href }
    if (input.space) source.space = input.space
    if (input.match) source.match = input.match
    if (input.exclude) source.exclude = input.exclude
    return source
  }
}

function shortUrl(href: string): string {
  const url = new URL(href)
  return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`
}
