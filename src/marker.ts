/**
 * Marker appended to comments sourcefed itself posts (if it ever posts), so the poller can tell
 * its own comments from human feedback. The monitor plugin is currently read-only on Jira, but
 * the marker contract exists so future write actions don't loop.
 */
export const SOURCEFED_COMMENT_MARKER = "⟦sourcefed⟧"
