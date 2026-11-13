import { readFileSync } from "node:fs"

// The root package.json is the one source of sourcefed's version; every bundle compiles it in.
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))

export const define = { __SOURCEFED_VERSION__: JSON.stringify(version) }
