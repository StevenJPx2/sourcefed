import type { SourceEvent } from "@sourcefed/core"
import { issueUrl, type JiraIssue } from "./api.ts"

export function matchedEvent(jql: string, issue: JiraIssue, at: string): SourceEvent {
  return {
    kind: "item.matched",
    id: `item.matched:${issue.key}:${at}`,
    at,
    summary: `Jira ${issue.key} matches ${quoted(jql)}: ${issue.title}`,
    body: issue.url,
    actionable: true,
    subject: { type: "jira-issue", key: issue.key, url: issue.url, title: issue.title },
  }
}

export function unmatchedEvent(jql: string, key: string, at: string): SourceEvent {
  const url = issueUrl(key)
  return {
    kind: "item.unmatched",
    id: `item.unmatched:${key}:${at}`,
    at,
    summary: `Jira ${key} no longer matches ${quoted(jql)}`,
    body: url,
    actionable: false,
    subject: { type: "jira-issue", key, url },
  }
}

export function limitEvent(jql: string, limit: number, at: string): SourceEvent {
  return {
    kind: "error",
    id: `error:limit:${at}`,
    at,
    summary: `More than ${limit.toLocaleString("en")} Jira issues match ${quoted(jql)}; matching pauses until fewer match`,
    body: "Narrow the JQL. Nothing is reported unmatched while the limit is passed.",
    actionable: true,
  }
}

export function quoted(jql: string): string {
  return `"${jql}"`
}
