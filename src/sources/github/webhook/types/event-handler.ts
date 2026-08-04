import type { GithubWebhookContext } from "./context.ts"
import type { GithubEventShape } from "./event-shape.ts"

export type GithubEventHandler = (context: GithubWebhookContext) => GithubEventShape
