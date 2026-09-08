import type { JiraCursor } from "../../types"

export function emptyJiraCursor(): JiraCursor {
  return { commentIds: [], descriptionVersion: undefined, changelogIds: [] }
}
