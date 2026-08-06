import assert from "node:assert/strict"
import { describe, test } from "node:test"
import type { Monitor } from "../../monitor.ts"
import type { MonitorContext } from "#sourcefed/types"
import { handleWebhook } from "./handle-webhook.ts"

describe("handleWebhook", () => {
  test("rejects oversized payloads before provider parsing", async () => {
    const source = { webhook: {} } as unknown as Monitor
    const context = {
      sourceForWebhookPath: () => source,
    } as unknown as MonitorContext
    const request = new Request("http://sourcefed.test/webhooks/test", {
      method: "POST",
      body: "too large",
      headers: { "content-length": String(1024 * 1024 + 1) },
    })

    const response = await handleWebhook(request, context)
    assert.equal(response.status, 413)
  })
})
