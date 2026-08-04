export function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  const remaining = maxLength - 1
  const leftLength = Math.ceil(remaining / 2)
  const rightLength = Math.floor(remaining / 2)
  return `${value.slice(0, leftLength)}…${value.slice(-rightLength)}`
}
