import { NodeHtmlMarkdown } from "node-html-markdown"

// GitHub comment bodies are markdown, but bots post literal HTML blocks (coverage
// tables, <details>, <h2>) that render as raw tags in a text session. Convert those
// to markdown; leave plain markdown untouched.
const HTML_TAG = /<(\/?)([a-z][a-z0-9]*)\b[^>]*>/i

export function htmlToMarkdown(text: string | undefined): string | undefined {
  if (!text || !HTML_TAG.test(text)) return text
  const markdown = NodeHtmlMarkdown.translate(text).trim()
  return markdown || text
}
