export function messageTimestamp(ts: string | undefined): number {
  const value = Number(ts ?? 0)
  if (Number.isFinite(value)) return value
  return 0
}
