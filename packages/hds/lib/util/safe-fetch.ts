import type { FetchHandler } from '@atcute/client'

/** Options for {@link rateLimitSafeFetchHandler}. See {@link RateLimitSafeWrapperOptions}. */
export type RateLimitSafeFetchHandlerOptions = RateLimitSafeWrapperOptions & {
  handler: FetchHandler
}

/** Wraps a {@link FetchHandler} to automatically retry on 429 responses. */
export function rateLimitSafeFetchHandler(options: RateLimitSafeFetchHandlerOptions): FetchHandler {
  return rateLimitSafeWrapper(options.handler, options)
}

/** Options for {@link rateLimitSafeFetch}. See {@link RateLimitSafeWrapperOptions}. */
export type RateLimitSafeFetchOptions = RateLimitSafeWrapperOptions & { fetch?: typeof fetch }

/** Wraps a `fetch` function to automatically retry on 429 responses. */
export function rateLimitSafeFetch(options: RateLimitSafeFetchOptions = {}): typeof fetch {
  return rateLimitSafeWrapper(options.fetch ?? globalThis.fetch, options)
}

type FetchLike = (input: any, init: any) => Promise<Response>

/** Options for {@link rateLimitSafeWrapper}. */
export interface RateLimitSafeWrapperOptions {
  /**
   * Maximum number of retry attempts before returning the 429 response.
   * @default 5
   */
  maxRetries?: number
  /**
   * Initial delay in ms for exponential backoff when the server provides no retry hint.
   * @default 1000
   */
  baseDelayMs?: number
  /**
   * Upper bound in ms for the exponential backoff delay.
   * @default 60_000
   */
  maxDelayMs?: number
}

/**
 * Implements the retry logic shared by the public API wrappers.
 * Returns a new function that:
 * 1. Waits if a previous 429 set a global backoff (`blockedUntil`).
 * 2. Fires the request and returns immediately if not rate-limited.
 * 3. On 429, parses the server's retry hint or falls back to exponential
 *    backoff with jitter, then retries up to `maxRetries` times.
 */
export function rateLimitSafeWrapper<T extends FetchLike>(
  wrappedFetch: T,
  { maxRetries = 5, baseDelayMs = 1000, maxDelayMs = 60_000 }: RateLimitSafeWrapperOptions,
): T {
  // Shared across all calls, one 429 pauses every caller
  let blockedUntil = 0

  return (async (input, init) => {
    for (let attempt = 0; ; attempt++) {
      // Honor any active global backoff before sending
      const now = Date.now()
      if (blockedUntil > now) {
        await Bun.sleep(blockedUntil - now)
      }

      const res = await wrappedFetch(input, init)

      if (res.status !== 429) return res
      if (attempt >= maxRetries) return res

      // Prefer the server's suggested delay, fall back to exponential backoff
      let delay = parseRetryDelay(res)
      if (delay == null) {
        const backoff = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs)
        const jitter = 5 + Math.random() * 10
        delay = backoff + jitter
      }

      // Block all callers, not just this one, to avoid stampeding the server
      blockedUntil = Date.now() + delay
      await Bun.sleep(delay)
    }
  }) as T
}

/** Extracts a retry delay, in milliseconds, from `Retry-After` or `RateLimit-Reset` headers. */
function parseRetryDelay(res: Response): number | null {
  // Retry-After can be an HTTP-date or a number of seconds
  const retryAfter = res.headers.get('retry-after')
  if (retryAfter) {
    const date = Date.parse(retryAfter)
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now())
    const seconds = Number(retryAfter)
    if (!Number.isNaN(seconds)) return seconds * 1000
  }

  // RateLimit-Reset is a Unix timestamp in seconds
  const reset = res.headers.get('ratelimit-reset')
  if (reset) {
    const ts = Number(reset)
    if (!Number.isNaN(ts)) return Math.max(0, ts * 1000 - Date.now())
  }

  return null
}
