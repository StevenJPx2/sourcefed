import type { Monitor, MonitorCreateInput, MonitorSource, SourceInput } from "@sourcefed/core"
import { GithubMonitor } from "@sourcefed/provider-github"
import { JiraMonitor } from "@sourcefed/provider-jira"
import { SlackMonitor } from "@sourcefed/provider-slack"

export const SOURCE_MAP = {
  jira: new JiraMonitor(),
  github: new GithubMonitor(),
  slack: new SlackMonitor(),
}

export const SOURCE_TYPES = Object.keys(SOURCE_MAP) as [string, ...string[]]

export function sourceDefinition(source: MonitorSource): Monitor<any> {
  return SOURCE_MAP[source.type as keyof typeof SOURCE_MAP]
}

export function isSource(input: SourceInput): input is MonitorSource {
  return typeof (input as { type?: unknown }).type === "string"
}

export function sourceForInput(type: MonitorSource["type"], input: MonitorCreateInput): SourceInput {
  const source = SOURCE_MAP[type as keyof typeof SOURCE_MAP]
  return source.build(input) as SourceInput
}

export function sourceForWebhookPath(pathname: string): Monitor<any> | undefined {
  const sources = Object.values(SOURCE_MAP)
  for (const source of sources) {
    if (source.webhook?.path === pathname) return source
  }
  return undefined
}
