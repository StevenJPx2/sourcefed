import type { GithubSourceRecord } from "../github/types"
import type { JiraSourceRecord } from "../jira/types"
import type { SlackSourceRecord } from "../slack/types"

export type MonitorSource = JiraSourceRecord | GithubSourceRecord | SlackSourceRecord
