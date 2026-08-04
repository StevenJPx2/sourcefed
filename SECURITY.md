# Security

Please do not report credentials, tokens, or signed webhook payloads in public issues.

Report security vulnerabilities privately to the repository owner through GitHub's
private vulnerability reporting when available. Include reproduction steps, impact,
and the smallest useful sanitized example.

Sourcefed stores monitor state locally and routes events into OpenCode sessions. Treat
the state directory, Slack browser-token stores, Jira credentials, and webhook secrets
as sensitive.
