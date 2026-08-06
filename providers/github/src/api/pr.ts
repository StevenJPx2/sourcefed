import { githubGraphQL } from "./client.ts"

export type GithubPrData = {
  reviews: any[]
  statusCheckRollup: any[]
  mergeable?: string
  mergeStateStatus?: string
  state?: string
}

const PR_DATA_QUERY = `
query PullRequestData($owner: String!, $name: String!, $number: Int!, $reviewsAfter: String, $contextsAfter: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      state
      mergeable
      mergeStateStatus
      reviews(first: 100, after: $reviewsAfter) {
        nodes {
          databaseId
          author { login }
          state
          submittedAt
          body
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
      statusCheckRollup {
        contexts(first: 100, after: $contextsAfter) {
          nodes {
            ... on StatusContext {
              context
              state
              targetUrl
            }
            ... on CheckRun {
              name
              conclusion
              detailsUrl
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
}`

const MAX_REVIEW_PAGES = 300

export async function fetchPrData(repo: string, prNumber: number): Promise<GithubPrData | undefined> {
  const [owner, name] = repo.split("/")
  if (!owner || !name) return undefined
  const data = await githubGraphQL(PR_DATA_QUERY, { owner, name, number: prNumber, reviewsAfter: undefined, contextsAfter: undefined })
  const pullRequest = data?.repository?.pullRequest
  if (!pullRequest) return undefined

  const reviews: any[] = []
  let page = pullRequest.reviews
  while (page?.nodes && page.nodes.length > 0) {
    reviews.push(...page.nodes.map((node: any) => ({
      id: node.databaseId,
      author: node.author,
      state: node.state,
      submittedAt: node.submittedAt,
      body: node.body,
    })))
    if (!page.pageInfo?.hasNextPage || reviews.length >= MAX_REVIEW_PAGES) break
    const next = await githubGraphQL(PR_DATA_QUERY, { owner, name, number: prNumber, reviewsAfter: page.pageInfo.endCursor, contextsAfter: undefined })
    page = next?.repository?.pullRequest?.reviews
  }

  const statusCheckRollup: any[] = []
  let contextsPage = pullRequest.statusCheckRollup?.contexts
  while (contextsPage?.nodes && contextsPage.nodes.length > 0) {
    statusCheckRollup.push(...contextsPage.nodes)
    if (!contextsPage.pageInfo?.hasNextPage) break
    const next = await githubGraphQL(PR_DATA_QUERY, { owner, name, number: prNumber, reviewsAfter: undefined, contextsAfter: contextsPage.pageInfo.endCursor })
    contextsPage = next?.repository?.pullRequest?.statusCheckRollup?.contexts
  }

  return {
    reviews,
    statusCheckRollup,
    mergeable: pullRequest.mergeable,
    mergeStateStatus: pullRequest.mergeStateStatus,
    state: pullRequest.state,
  }
}
