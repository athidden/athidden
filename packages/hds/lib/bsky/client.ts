import { Client, type XRPCErrorPayload, simpleFetchHandler } from '@atcute/client'

import { env } from '../env'
import { Result, rateLimitSafeFetchHandler } from '../util'

export const bluesky = new Client({
  handler: rateLimitSafeFetchHandler({
    handler: simpleFetchHandler({
      service: env.HDS_BSKY_APPVIEW_URL,
    }),
  }),
})

export const constellation = new Client({
  handler: rateLimitSafeFetchHandler({
    handler: simpleFetchHandler({
      service: env.HDS_CONSTELLATION_URL,
    }),
  }),
})

type ClientResponseLike = { ok: true; data: unknown } | { ok: false; data: XRPCErrorPayload }

type ClientResponseResult<T extends ClientResponseLike> = Result<
  T extends { ok: true; data: infer D } ? D : never,
  string
>

export const asResult: {
  <T extends ClientResponseLike>(promise: Promise<T>): Promise<ClientResponseResult<T>>
  <T extends ClientResponseLike>(response: T): ClientResponseResult<T>
} = (input: Promise<ClientResponseLike> | ClientResponseLike): any => {
  if (input instanceof Promise) {
    return input.then(asResult)
  }
  if (input.ok) {
    return Result.ok(input.data)
  } else {
    return Result.err(input.data.error, input.data.message)
  }
}
