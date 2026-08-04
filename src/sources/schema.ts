import * as v from "valibot"
import { GithubSourceSchema } from "./github/schema.ts"
import { JiraSourceSchema } from "./jira/schema.ts"
import { SlackSourceSchema } from "./slack/schema.ts"

export const MonitorSourceSchema = v.variant("type", [GithubSourceSchema, JiraSourceSchema, SlackSourceSchema])
