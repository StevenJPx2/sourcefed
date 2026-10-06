# sourcefed monitors

Monitors watch a Jira issue, GitHub PR, or Slack thread and bring new events into this session.

Create one with `monitor_create` when:

- you work on a Jira ticket: `{ name: "<key>", sourceType: "jira", issueKey: "PROJ-123" }`
  (new comments, edits, status, assignee, priority, labels);
- your branch has a PR: `{ name: "<pr>", sourceType: "github", repo: "owner/name", prNumber: 42 }`
  (reviews, comments, CI failures, conflicts, merge or close);
- you were given a Slack thread: `{ name: "<thread>", sourceType: "slack", threadUrl: "<url>" }`
  (new messages; read-only, never replies).

Keep the default `pollIntervalSec` unless the work is time-sensitive (min 15).
`monitor_list`, `monitor_status { id }` and `monitor_stop { id }` act on this session's monitors.
GitHub monitors end when the PR merges.

An event arrives as a message. Act on it if it needs action, or tell the user it needs a
decision; acknowledge an informational one (such as CI passing) and move on. Never invent work
from it. `sourcefed skills get core` has the full guide.
