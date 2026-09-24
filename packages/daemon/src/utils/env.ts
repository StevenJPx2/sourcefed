import os from "node:os"
import path from "node:path"

const DAEMON_ENVIRONMENT = [
  "PATH",
  "HOME",
  "USER",
  "TMPDIR",
  "LANG",
  "XDG_CONFIG_HOME",
  "XDG_STATE_HOME",
  "ATLASSIAN_EMAIL",
  "ATLASSIAN_API_KEY",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "SOURCEFED_JIRA_BASE_URL",
  "SOURCEFED_JIRA_TERMINAL_STATUS",
  "SOURCEFED_STATE_DIR",
  "SOURCEFED_DAEMON_TOKEN",
  "SOURCEFED_SLACK_TOKEN",
  "SOURCEFED_GITHUB_WEBHOOK_SECRET",
  "SOURCEFED_SLACK_SIGNING_SECRET",
  "SOURCEFED_ENABLE_WEBHOOKS",
  "SOURCEFED_WEBHOOK_HOST",
  "SOURCEFED_WEBHOOK_PORT",
] as const

export function daemonEnvironment(host?: string): Record<string, string> {
  const environment = Object.fromEntries(
    DAEMON_ENVIRONMENT.flatMap((name) => process.env[name] === undefined ? [] : [[name, process.env[name]!]]),
  )
  if (host) environment.SOURCEFED_STATE_DIR ??= path.join(process.env.XDG_STATE_HOME ?? path.join(os.homedir(), ".local", "state"), "sourcefed", host)
  return environment
}
