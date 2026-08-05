export class RequestRouter {
  private readonly pending = new Map<number, { resolve(result: unknown): void; reject(error: Error): void }>()
  private cursor = 1

  nextID(): number {
    return this.cursor++
  }

  register(id: number): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
    })
  }

  settle(id: number, frame: { result?: unknown; error?: string }): void {
    const pending = this.pending.get(id)
    if (!pending) return
    this.pending.delete(id)
    if (frame.error) pending.reject(new Error(frame.error))
    else pending.resolve(frame.result)
  }

  rejectAll(error: Error): void {
    for (const { reject } of this.pending.values()) reject(error)
    this.pending.clear()
  }
}
