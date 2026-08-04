import { GithubMonitor } from "@sourcefed/provider-github"
import { JiraMonitor } from "@sourcefed/provider-jira"
import { SlackMonitor } from "@sourcefed/provider-slack"

export const SOURCE_MAP = {
  jira: new JiraMonitor(),
  github: new GithubMonitor(),
  slack: new SlackMonitor(),
}

export const SOURCE_TYPES = Object.keys(SOURCE_MAP) as [string, ...string[]]
