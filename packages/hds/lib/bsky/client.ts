import { Client, simpleFetchHandler } from '@atcute/client'

import { env } from '../env'
import { rateLimitSafeFetchHandler } from '../util'

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
