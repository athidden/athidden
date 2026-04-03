/**
 * Represents one coalesced request, a part of a batch of requests, that must
 * be completed and resolved.
 */
export interface CoalesceRequest<T, R> {
  params: T
  resolvers: PromiseWithResolvers<R>
}

/**
 * Merges and batches concurrent calls to `use()` with the same key into a
 * single `action` invocation, fired after `delay` ms.
 */
export class Coalesce<T, R> {
  #requests: Map<string, CoalesceRequest<T, R>> = new Map()
  #timeout: NodeJS.Timeout | null = null

  #action: (requests: CoalesceRequest<T, R>[]) => unknown
  #keyOf: (params: T) => string

  #delay: number

  constructor(options: {
    action: (requests: CoalesceRequest<T, R>[]) => unknown
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
