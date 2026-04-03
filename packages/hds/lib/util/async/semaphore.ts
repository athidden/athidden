/**
 * Limits concurrency by allowing up to `concurrency` simultaneous tasks to be
 * running at any given time, and blocking new tasks from starting until old
 * tasks complete.
 */
export class Semaphore {
  #active = 0
  #queue: Array<() => void> = []

  constructor(readonly concurrency: number) {}

  acquire(): Promise<void> {
    if (this.#active < this.concurrency) {
      this.#active++
      return Promise.resolve()
    } else {
      return new Promise<void>((resolve) => this.#queue.push(resolve))
    }
  }

  release(): void {
    const next = this.#queue.shift()
    if (next) {
      next() // Transfers the slot, #active stays the same
    } else {
      this.#active--
    }
  }

  async use<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }
}
