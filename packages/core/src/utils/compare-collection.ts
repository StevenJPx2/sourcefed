import * as v from "valibot"

/** The most items a collection monitor follows. Past it, matching pauses and one error event says so. */
export const COLLECTION_LIMIT = 1_000

export const CollectionCursorSchema = v.object({
  primed: v.boolean(),
  keys: v.array(v.string()),
  overLimit: v.optional(v.boolean(), false),
})

export type CollectionCursor = v.InferOutput<typeof CollectionCursorSchema>

/** One poll's listing: every matching item, or `overLimit` when more than COLLECTION_LIMIT match. */
export type CollectionListing<TItem> = { overLimit: false; items: TItem[] } | { overLimit: true }

export type CollectionChanges<TItem> = {
  cursor: CollectionCursor
  matched: TItem[]
  unmatched: string[]
  reachedLimit: boolean
}

/**
 * Compare a listing with the keys of the last one. The first listing primes the
 * cursor silently unless `includeExisting`. Over the limit, the keys stay as they
 * were, so nothing is reported gone, and `reachedLimit` is true only on the poll
 * that crosses it.
 */
export function compareCollection<TItem>(
  cursorRaw: unknown,
  listing: CollectionListing<TItem>,
  key: (item: TItem) => string,
  includeExisting: boolean,
): CollectionChanges<TItem> {
  const parsed = v.safeParse(CollectionCursorSchema, cursorRaw)
  const previous: CollectionCursor = parsed.success ? parsed.output : { primed: false, keys: [], overLimit: false }

  if (listing.overLimit || listing.items.length > COLLECTION_LIMIT) {
    const cursor = { ...previous, overLimit: true }
    return { cursor, matched: [], unmatched: [], reachedLimit: !previous.overLimit }
  }

  const known = new Set(previous.keys)
  const current = new Map(listing.items.map((item) => [key(item), item]))
  const announce = previous.primed || includeExisting
  const matched = announce ? [...current].filter(([itemKey]) => !known.has(itemKey)).map(([, item]) => item) : []
  const unmatched = previous.keys.filter((itemKey) => !current.has(itemKey))

  const cursor = { primed: true, keys: [...current.keys()], overLimit: false }
  return { cursor, matched, unmatched, reachedLimit: false }
}
