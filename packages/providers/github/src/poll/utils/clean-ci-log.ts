const ANSI_ESCAPE = /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g
const LOG_PREFIX = /^.*?\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z(?:\s+(?:stdout|stderr))?\s*(?:\|\s*)?/

export function cleanCiLog(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .replace(ANSI_ESCAPE, "")
    .split("\n")
    .map((line) => line.replace(LOG_PREFIX, "").trimEnd())
    .filter((line) => !/\bis in dev mode\. Not recommended for production!/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
