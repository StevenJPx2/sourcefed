---
name: sourcefed
description: Live Jira, GitHub, Slack, and Yab feed monitoring for agent hosts. Create monitors that route new issue comments, PR reviews, CI failures, Slack thread or DM messages, and new entries of feeds read through Yab into the current session as they happen.
hidden: true
---

# Sourcefed

Sourcefed turns external collaboration threads into live agent input: create a
monitor for a Jira issue, GitHub PR, Slack thread, Slack DM, or a feed read through Yab and NEW events are routed
into the session you are working in, so you can react to them as they happen.

This file is a discovery stub, not the usage guide. Before running any
`sourcefed` command, load the actual workflow content from the CLI:

```bash
sourcefed skills get core             # start here — workflows, patterns, troubleshooting
sourcefed skills get core --full      # include full command reference and templates
```

The CLI serves skill content that always matches the installed version, so
instructions never go stale. The content in this stub cannot change between
releases, which is why it just points at `skills get core`.

## When to load this skill

- A user asks to monitor a Jira ticket, GitHub PR, Slack thread, or Slack DM.
- A user wants to hear about new entries in a feed or inbox they are signed in to in Yab.
- You found or are working on a Jira ticket, PR, thread, or DM and want new
  activity routed into your session.
- You opened a PR and want to be notified of reviews, comments, CI failures,
  merge conflicts, or the merge itself.
