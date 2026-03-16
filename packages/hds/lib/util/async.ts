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
      next() // transfers the slot, #active stays the same
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

export interface CoalescerRequest<T, R> {
  params: T
  resolvers: PromiseWithResolvers<R>
}

export class Coalescer<T, R> {
  #requests: Map<string, CoalescerRequest<T, R>> = new Map()
  #timeout: NodeJS.Timeout | null = null

  #action: (requests: CoalescerRequest<T, R>[]) => unknown
  #keyOf: (params: T) => string

  #delay: number

  constructor(options: {
    action: (requests: CoalescerRequest<T, R>[]) => unknown
    keyOf: (params: T) => string
    delay?: number
  }) {
    this.#action = options.action
    this.#keyOf = options.keyOf
    this.#delay = options.delay ?? 0
  }

  use(params: T): Promise<R> {
    const key = this.#keyOf(params)

    const request = this.#requests.get(key)
    if (request != null) {
      return request.resolvers.promise
    }

    const resolvers = Promise.withResolvers<R>()
    this.#requests.set(key, { params, resolvers })

    if (this.#timeout == null) {
      this.#timeout = setTimeout(() => {
        this.#timeout = null
        const requests = this.#requests.values().toArray()
        this.#requests.clear()
        this.#action(requests)
      }, this.#delay)
    }

    return resolvers.promise
  }
}
