/**
 * Deduplicates concurrent calls to `use()` with the same key, sharing the
 * in-flight promise.
 */
export class Dedupe<K, V> {
  #pending = new Map<string, Promise<V>>()

  #perform: (params: K) => Promise<V>
  #keyOf: (params: K) => string

  constructor(options: { perform: (params: K) => Promise<V>; keyOf: (params: K) => string }) {
    this.#perform = options.perform
    this.#keyOf = options.keyOf
  }

  use(params: K): Promise<V> {
    const key = this.#keyOf(params)

    const existing = this.#pending.get(key)
    if (existing != null) return existing

    const promise = this.#perform(params)
    this.#pending.set(key, promise)
    return promise.finally(() => this.#pending.delete(key))
  }
}
