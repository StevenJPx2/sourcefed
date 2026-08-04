import path from "node:path"
import { fileURLToPath } from "node:url"

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
export const STATE_DIR = path.join(PLUGIN_ROOT, ".state")
export const STATE_FILE = path.join(STATE_DIR, "monitors.json")
