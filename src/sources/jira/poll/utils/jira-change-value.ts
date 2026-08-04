export function jiraChangeValue(item: any, side: "from" | "to"): string {
  let value = item.toString ?? item.to
  if (side === "from") value = item.fromString ?? item.from
  if (value === undefined || value === null || value === "") return "none"
  return String(value)
}
