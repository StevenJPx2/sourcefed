import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { COLLECTION_LIMIT, compareCollection } from "./compare-collection.ts"

type Item = { key: string }
const key = (item: Item): string => item.key
const items = (...keys: string[]): Item[] => keys.map((itemKey) => ({ key: itemKey }))

describe("compareCollection", () => {
  test("primes silently on the first listing", () => {
    const changes = compareCollection(undefined, { overLimit: false, items: items("a", "b") }, key, false)

    assert.deepEqual(changes.matched, [])
    assert.deepEqual(changes.unmatched, [])
    assert.deepEqual(changes.cursor, { primed: true, keys: ["a", "b"], overLimit: false })
  })

  test("announces every current item on the first listing with includeExisting", () => {
    const changes = compareCollection(undefined, { overLimit: false, items: items("a", "b") }, key, true)

    assert.deepEqual(changes.matched, items("a", "b"))
  })

  test("reports new keys as matched and gone keys as unmatched", () => {
    const cursor = { primed: true, keys: ["a", "b"], overLimit: false }

    const changes = compareCollection(cursor, { overLimit: false, items: items("b", "c") }, key, false)

    assert.deepEqual(changes.matched, items("c"))
    assert.deepEqual(changes.unmatched, ["a"])
    assert.deepEqual(changes.cursor.keys, ["b", "c"])
  })

  test("over the limit, keeps the keys and reaches the limit once", () => {
    const cursor = { primed: true, keys: ["a"], overLimit: false }
    const tooMany = items(...Array.from({ length: COLLECTION_LIMIT + 1 }, (_, index) => `k${index}`))

    const first = compareCollection(cursor, { overLimit: false, items: tooMany }, key, false)
    const second = compareCollection(first.cursor, { overLimit: true }, key, false)
    const back = compareCollection(second.cursor, { overLimit: false, items: items("a", "z") }, key, false)

    assert.equal(first.reachedLimit, true)
    assert.deepEqual(first.unmatched, [])
    assert.deepEqual(first.cursor, { primed: true, keys: ["a"], overLimit: true })
    assert.equal(second.reachedLimit, false)
    assert.deepEqual(back.matched, items("z"))
    assert.equal(back.cursor.overLimit, false)
  })
})
