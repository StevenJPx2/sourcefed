export function formatTimestamp(value: unknown): string {
  if (value === undefined || value === null || value === "" || value === 0) return "never"
  let dateValue: number | string = String(value)
  if (typeof value === "number") dateValue = value
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}
