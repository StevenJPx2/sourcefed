export interface GithubCursor {
  reviewIds: string[]
  commentIds: string[]
  historyPrimed: boolean
  lineCommentsPrimed: boolean
  conversationCommentsPrimed: boolean
  ciState: string
  ciFailureState: string
  mergeable: string
  prState: string
}
