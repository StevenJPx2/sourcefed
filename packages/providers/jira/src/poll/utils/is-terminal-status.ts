export function isTerminalStatus(status: unknown): boolean {
  if (typeof status !== "string") return false

  const terminalStatus = process.env.SOURCEFED_JIRA_TERMINAL_STATUS
  if (!terminalStatus) return false

  return status.trim().toLowerCase() === terminalStatus.trim().toLowerCase()
}
