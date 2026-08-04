import { GithubMonitor } from "./github"
import { JiraMonitor } from "./jira"
import { SlackMonitor } from "./slack"

/** The registry contains only instantiated source monitors. */
export const SOURCE_MAP = {
  jira: new JiraMonitor(),
  github: new GithubMonitor(),
  slack: new SlackMonitor(),
}

export type { MonitorSource, SourceInput } from "./types"
