import type { FetchHandler } from '@atcute/client'

/* oxlint-disable no-await-in-loop */

export type RateLimitSafeFetchHandlerOptions = RateLimitSafeWrapperOptions & {
  handler: FetchHandler
}

export function rateLimitSafeFetchHandler(options: RateLimitSafeFetchHandlerOptions): FetchHandler {
  return rateLimitSafeWrapper(options.handler, options)
}

export type RateLimitSafeFetchOptions = RateLimitSafeWrapperOptions & { fetch?: typeof fetch }

export function rateLimitSafeFetch(options: RateLimitSafeFetchOptions = {}): typeof fetch {
  return rateLimitSafeWrapper(options.fetch ?? globalThis.fetch, options)
}

type FetchLike = (input: any, init: any) => Promise<Response>

interface RateLimitSafeWrapperOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
}

function rateLimitSafeWrapper<T extends FetchLike>(
  wrappedFetch: T,
  { maxRetries = 5, baseDelayMs = 1000, maxDelayMs = 60_000 }: RateLimitSafeWrapperOptions,
): T {
  let blockedUntil = 0

  return (async (input, init) => {
    for (let attempt = 0; ; attempt++) {
      const now = Date.now()
      if (blockedUntil > now) {
        await Bun.sleep(blockedUntil - now)
      }

      const res = await wrappedFetch(input, init)

      if (res.status !== 429) return res
      if (attempt >= maxRetries) return res

      let delay = parseRetryDelay(res)
      if (delay == null) {
        const backoff = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs)
        const jitter = 5 + Math.random() * 10
        delay = backoff + jitter
      }

      blockedUntil = Date.now() + delay
      await Bun.sleep(delay)
    }
  }) as T
}

function parseRetryDelay(res: Response): number | null {
  const retryAfter = res.headers.get('retry-after')
  if (retryAfter) {
    const date = Date.parse(retryAfter)
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now())
    const seconds = Number(retryAfter)
    if (!Number.isNaN(seconds)) return seconds * 1000
  }

  const reset = res.headers.get('ratelimit-reset')
  if (reset) {
    const ts = Number(reset)
    if (!Number.isNaN(ts)) return Math.max(0, ts * 1000 - Date.now())
  }

  return null
}
