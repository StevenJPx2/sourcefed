import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { htmlToMarkdown } from "./html-to-markdown.ts"

describe("htmlToMarkdown", () => {
  test("leaves plain markdown untouched", () => {
    const md = "Please fix the **lint** error, see `foo.ts`."
    assert.equal(htmlToMarkdown(md), md)
  })

  test("passes through undefined/empty", () => {
    assert.equal(htmlToMarkdown(undefined), undefined)
    assert.equal(htmlToMarkdown(""), "")
  })

  test("converts an HTML coverage comment to markdown", () => {
    const html = "<h2>Coverage (amt)</h2>Coverage will be <b>89.03%</b>" +
      "<table><tbody><tr><th>File</th><th>Stmts</th></tr>" +
      "<tr><td><a href='https://example.com/base.ts'>base.ts</a></td><td>86%</td></tr></tbody></table>"
    const md = htmlToMarkdown(html) ?? ""
    assert.match(md, /## Coverage \(amt\)/)
    assert.match(md, /\*\*89\.03%\*\*/)
    assert.match(md, /\| *File *\| *Stmts *\|/)
    assert.match(md, /\[base\.ts\]\(https:\/\/example\.com\/base\.ts\)/)
    assert.doesNotMatch(md, /<td>|<table>|<a /)
  })

  test("decodes entities in mixed content", () => {
    assert.match(htmlToMarkdown("<b>10</b>&ndash;<b>19</b>") ?? "", /10.*19/)
  })
})
