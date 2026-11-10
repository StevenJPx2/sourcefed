import type { FeedEntry } from "../../types"

// Mail and newsletter feeds pad previews with zero-width and joiner characters.
const INVISIBLE = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u3164\uFEFF]/g
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }

/** Entries of an Atom, RSS or JSON feed, in the order the feed lists them. */
export function parseFeed(body: string, type = ""): FeedEntry[] {
  const text = body.trim()
  if (/json/i.test(type) || text.startsWith("{") || text.startsWith("[")) return parseJsonFeed(text)
  if (!/<(feed|rss|rdf:RDF)[\s>]/i.test(text)) throw new Error("the page is not an Atom, RSS or JSON feed")

  const entries = elements(text, "entry")
  const blocks = entries.length > 0 ? entries : elements(text, "item")
  return blocks.map(xmlEntry).filter((entry): entry is FeedEntry => entry !== undefined)
}

function xmlEntry(block: string): FeedEntry | undefined {
  const title = clean(child(block, "title")) ?? ""
  const summary = clean(child(block, "summary") ?? child(block, "description") ?? child(block, "content") ?? child(block, "content:encoded"))
  const link = atomLink(block) ?? clean(child(block, "link"))
  const at = firstDate([child(block, "updated"), child(block, "modified"), child(block, "issued"), child(block, "published"), child(block, "pubDate"), child(block, "dc:date")])
  const id = clean(child(block, "id")) ?? clean(child(block, "guid")) ?? link ?? (title && at ? `${title}@${at}` : title)
  if (!id) return undefined
  return compact({ id, title, summary, author: xmlAuthor(block), link, at })
}

function xmlAuthor(block: string): string | undefined {
  const author = child(block, "author")
  if (author && /<(name|email)[\s>]/i.test(author)) {
    const name = clean(child(author, "name"))
    const email = clean(child(author, "email"))
    if (name && email) return `${name} <${email}>`
    return name ?? email
  }
  return clean(author) ?? clean(child(block, "dc:creator"))
}

function atomLink(block: string): string | undefined {
  let fallback: string | undefined
  for (const match of block.matchAll(/<link\b([^>]*?)\/?>/gi)) {
    const attributes = match[1] ?? ""
    const href = attributes.match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1]
    if (!href) continue
    const rel = attributes.match(/\brel\s*=\s*["']([^"']*)["']/i)?.[1]
    if (!rel || rel === "alternate") return decodeEntities(href)
    fallback ??= decodeEntities(href)
  }
  return fallback
}

function parseJsonFeed(text: string): FeedEntry[] {
  const data = JSON.parse(text)
  let items: unknown[] | undefined
  if (Array.isArray(data)) items = data
  else if (Array.isArray(data?.items)) items = data.items
  else if (Array.isArray(data?.entries)) items = data.entries
  if (!items) throw new Error("the JSON has no items or entries list")

  const entries: FeedEntry[] = []
  for (const item of items as any[]) {
    if (!item || typeof item !== "object") continue
    const link = text_(item.url ?? item.link ?? item.html_url)
    const title = clean(text_(item.title ?? item.subject ?? item.name)) ?? ""
    const at = firstDate([item.date_published, item.date_modified, item.updated, item.published, item.date, item.created_at])
    const id = text_(item.id ?? item.guid) ?? link ?? (title && at ? `${title}@${at}` : title)
    if (!id) continue
    const summary = clean(text_(item.summary ?? item.content_text ?? item.description ?? item.content_html ?? item.body ?? item.text))
    const author = clean(text_(item.author?.name ?? item.authors?.[0]?.name ?? item.author ?? item.from))
    entries.push(compact({ id, title, summary, author, link, at }))
  }
  return entries
}

function elements(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi")
  return [...xml.matchAll(pattern)].map((match) => match[1] ?? "")
}

function child(xml: string, tag: string): string | undefined {
  return elements(xml, tag)[0]
}

function clean(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const unwrapped = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  // Strip markup before and after decoding, so escaped HTML in RSS descriptions goes too.
  const decoded = decodeEntities(stripTags(unwrapped))
  const text = stripTags(decoded).replace(INVISIBLE, "").replace(/\s+/g, " ").trim()
  return text || undefined
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ")
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name[0] === "#") {
      const code = name[1]?.toLowerCase() === "x" ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10)
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : entity
    }
    return ENTITIES[name.toLowerCase()] ?? entity
  })
}

function firstDate(values: unknown[]): string | undefined {
  for (const value of values) {
    const raw = typeof value === "string" ? clean(value) : undefined
    if (!raw) continue
    const time = Date.parse(raw)
    if (!Number.isNaN(time)) return new Date(time).toISOString()
  }
  return undefined
}

function text_(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number") return String(value)
  return undefined
}

function compact(entry: FeedEntry): FeedEntry {
  const result: FeedEntry = { id: entry.id, title: entry.title }
  if (entry.summary) result.summary = entry.summary
  if (entry.author) result.author = entry.author
  if (entry.link) result.link = entry.link
  if (entry.at) result.at = entry.at
  return result
}
