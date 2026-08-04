import type { GithubCursor } from "../../types"

export function emptyGithubCursor(): GithubCursor {
  return {
    reviewIds: [],
    commentIds: [],
    historyPrimed: false,
    conversationCommentsPrimed: false,
    ciState: "",
    ciFailureState: "",
    mergeable: "",
    prState: "",
  }
}
