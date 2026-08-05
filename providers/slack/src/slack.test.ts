import assert from "node:assert/strict"
import { describe, test } from "node:test"
import type { MonitorRecord, MonitorSource } from "@sourcefed/core"
import type { SlackSourceRecord } from "./types"
import { SlackMonitor } from "./index"
import { parseSlackReadResult } from "./poll"
import { parseSlackWebhook, slackSignature, validSlackSignature } from "./webhook"
import { updateSlackCursor } from "./webhook/utils/update-slack-cursor.ts"

process.env.SOURCEFED_SLACK_SIGNING_SECRET ??= "test-signing-secret"

describe("Slack monitor source", () => {
  test("uses one instantiated source object from the registry", () => {
    const monitor = new SlackMonitor()
    const source: SlackSourceRecord = { type: "slack", channelId: "D123456", threadTs: "1712345678.901234" }
    assert.deepEqual(monitor.validateSource(source), source)
  })

  test("parses a Slack thread URL with an explicit parent timestamp", () => {
    const source = new SlackMonitor().build({
      threadUrl: "https://workspace.slack.com/archives/D123456/p1712345680000001?thread_ts=1712345678.901234",
    })

    assert.deepEqual(source, { type: "slack", channelId: "D123456", threadTs: "1712345678.901234" })
  })

  test("converts a parent message path timestamp when no query timestamp exists", () => {
    const source = new SlackMonitor().build({
      threadUrl: "https://workspace.slack.com/archives/D123456/p1712345678901234",
    })

    assert.deepEqual(source, { type: "slack", channelId: "D123456", threadTs: "1712345678.901234" })
  })

  test("requires a channel and thread timestamp", () => {
    assert.deepEqual(new SlackMonitor().build({ threadUrl: "https://workspace.slack.com/client" }), {
      error: "threadUrl does not contain a Slack channel and thread timestamp",
    })
  })

  test("prefers webhook delivery when the signing secret is available", () => {
    const source: MonitorSource = { type: "slack", channelId: "D123456", threadTs: "1712345678.901234" }
    const monitor = new SlackMonitor()
    assert.equal(monitor.initialDelivery(source), "webhook")
    assert.equal(monitor.webhook?.preferred, true)
  })
})

describe("Slack webhook events", () => {
  test("accepts only new replies in a thread", () => {
    const event = parseSlackWebhook({
      type: "event_callback",
      event: {
        type: "message",
        channel: "D123456",
        thread_ts: "1712345678.901234",
        ts: "1712345680.000001",
        user: "U123",
        text: "A new reply",
      },
    }, "slack", "Ev123")

    assert.deepEqual(event?.source, { type: "slack", channelId: "D123456", threadTs: "1712345678.901234" })
    assert.ok(event?.body?.includes("A new reply") === true)
    assert.equal(event?.at, new Date(1712345680.000001 * 1000).toISOString())
  })

  test("ignores a top-level message and non-message events", () => {
    assert.equal(parseSlackWebhook({ type: "event_callback", event: { type: "message", channel: "D123456", ts: "1712345678.901234" } }, "slack", "Ev1"), undefined)
    assert.equal(parseSlackWebhook({ type: "event_callback", event: { type: "reaction_added", item: { channel: "D123456" } } }, "slack", "Ev2"), undefined)
  })
})

describe("Slack poll cursor", () => {
  test("primes existing history and emits only later replies", () => {
    const initial = parseSlackReadResult({
      messages: [
        { ts: "1712345678.901234", text: "Parent" },
        { ts: "1712345680.000001", thread_ts: "1712345678.901234", user: "U123", text: "Existing reply" },
      ],
      users: [{ id: "U123", real_name: "Test User" }],
    }, undefined)

    assert.equal(initial.events.length, 0)
    assert.equal(initial.cursor.primed, true)
    assert.deepEqual(initial.cursor.messageIds, ["1712345678.901234", "1712345680.000001"])

    const next = parseSlackReadResult({
      messages: [
        { ts: "1712345678.901234", text: "Parent" },
        { ts: "1712345680.000001", thread_ts: "1712345678.901234", user: "U123", text: "Existing reply" },
        { ts: "1712345690.000001", thread_ts: "1712345678.901234", user: "U123", text: "New reply" },
      ],
      users: [{ id: "U123", real_name: "Test User" }],
    }, initial.cursor)

    assert.equal(next.events.length, 1)
    assert.partialDeepStrictEqual(next.events[0], {
      summary: "Slack thread message by Test User",
      body: "New reply",
      actionable: true,
    })
  })

  test("keeps messages after the last webhook event during poll fallback", () => {
    const cursor = updateSlackCursor({
      source: { type: "slack", channelId: "D123456", threadTs: "1712345678.901234" },
      kind: "message",
      id: "message:1712345690.000001",
      at: "2024-04-05T12:34:50.000Z",
      summary: "webhook message",
      actionable: true,
    }, undefined)

    const result = parseSlackReadResult({
      messages: [
        { ts: "1712345678.901234", text: "Parent" },
        { ts: "1712345680.000001", text: "Old reply" },
        { ts: "1712345690.000001", text: "Webhook reply" },
        { ts: "1712345695.000001", text: "Outage reply" },
      ],
    }, cursor)

    assert.equal(result.events.length, 1)
    assert.equal(result.events[0].body, "Outage reply")
  })
})

describe("Slack request verification", () => {
  test("accepts a current correctly signed request", () => {
    const body = JSON.stringify({ type: "event_callback" })
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const request = new Request("http://localhost/webhooks/slack", {
      method: "POST",
      body,
      headers: {
        "x-slack-request-timestamp": timestamp,
        "x-slack-signature": slackSignature(body, timestamp, "test-signing-secret"),
      },
    })

    assert.equal(validSlackSignature(body, request, "test-signing-secret"), true)
  })

  test("rejects stale requests", () => {
    const body = "{}"
    const timestamp = (Math.floor(Date.now() / 1000) - 301).toString()
    const request = new Request("http://localhost/webhooks/slack", {
      method: "POST",
      body,
      headers: {
        "x-slack-request-timestamp": timestamp,
        "x-slack-signature": slackSignature(body, timestamp, "test-signing-secret"),
      },
    })

    assert.equal(validSlackSignature(body, request, "test-signing-secret"), false)
  })
})

describe("transport recovery", () => {
  const monitor: MonitorRecord = {
    id: "m-test",
    name: "Slack test",
    source: { type: "slack", channelId: "D123456", threadTs: "1712345678.901234" },
    delivery: "poll",
    target: { kind: "test-session", id: "session-test" },
    pollIntervalSec: 60,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cursors: { __webhookHeartbeatAt: Date.now() },
  }

  test("recovers from polling to a healthy webhook", () => {
    assert.equal(new SlackMonitor().resolveDelivery(monitor), "webhook")
  })

  test("falls back to polling when the webhook heartbeat is stale", () => {
    const stale: MonitorRecord = { ...monitor, delivery: "webhook", cursors: { __webhookHeartbeatAt: Date.now() - 120_000 } }
    assert.equal(new SlackMonitor().resolveDelivery(stale), "poll")
  })
})
