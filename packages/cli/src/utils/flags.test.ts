import assert from "node:assert/strict"
import { test } from "node:test"
import { flags } from "./flags.ts"

test("a repeated flag keeps every value whole, commas included", () => {
  const args = ["--event-id", "m-1:ci:Coverage:FAILURE,Lint:FAILURE", "--target-id", "ses_1", "--event-id", "m-2:issue:5"]

  assert.deepEqual(flags(args, "event-id"), ["m-1:ci:Coverage:FAILURE,Lint:FAILURE", "m-2:issue:5"])
  assert.deepEqual(flags(["--event-id"], "event-id"), [])
})
