const SLACK_API = "https://slack.com/api"

let warnedMissingToken = false

function slackToken(): string | undefined {
  return process.env.SOURCEFED_SLACK_TOKEN
}

export async function fetchSlackThread(channelId: string, threadTs: string): Promise<{ messages: any[]; users: any[] } | undefined> {
  const messages: any[] = []
  let cursor = ""
  let received = false
  do {
    const page = await slackApi("conversations.replies", {
      channel: channelId,
      ts: threadTs,
      limit: "1000",
      inclusive: "false",
      ...(cursor ? { cursor } : {}),
    })
    if (!page) break
    received = true
    if (Array.isArray(page.messages)) messages.push(...page.messages)
    cursor = page.response_metadata?.next_cursor ?? ""
    if (messages.length >= 10_000) break
  } while (cursor)
  if (!received) return undefined
  const users: any[] = []
  let usersCursor = ""
  do {
    const page = await slackApi("users.list", { limit: "200", ...(usersCursor ? { cursor: usersCursor } : {}) })
    if (!page) break
    if (Array.isArray(page.members)) {
      users.push(...page.members.map((member: any) => ({
        id: member.id,
        name: member.name,
        real_name: member.real_name,
      })))
    }
    usersCursor = page.response_metadata?.next_cursor ?? ""
  } while (usersCursor)
  const result: { messages: any[]; users: any[] } = { messages, users }
  return result
}

async function slackApi(method: string, params: Record<string, string>): Promise<any | undefined> {
  const token = slackToken()
  if (!token) {
    if (!warnedMissingToken) {
      warnedMissingToken = true
      console.warn("[sourcefed] SOURCEFED_SLACK_TOKEN is not set; Slack monitors will not poll")
    }
    return undefined
  }
  try {
    const response = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    })
    const result = (await response.json()) as { ok?: boolean }
    if (!response.ok || result?.ok !== true) return undefined
    return result
  } catch {
    return undefined
  }
}
