import { mkdirSync } from 'node:fs'

import { ZodError, z } from 'zod'

export type Env = z.infer<typeof Env>
export const Env = z.object({
  HDS_DATA_DIRECTORY: z.string().nonempty().default('./data'),

  HDS_DID: z.string().startsWith('did:web:'),
  HDS_DID_PLC_URL: z.url().default('https://plc.directory'),

  HDS_BSKY_APPVIEW_URL: z.url().default('https://public.api.bsky.app'),
  HDS_CONSTELLATION_URL: z.url().default('https://constellation.microcosm.blue'),

  HDS_IDENTITY_CACHE_TTL: z.int().default(24 * 60 * 60),
  HDS_RELATIONSHIP_CACHE_TTL: z.int().default(60),
  HDS_LIST_CACHE_TTL: z.int().default(300),
})

export const env: Env = (() => {
  try {
    return Env.parse(Bun.env)
  } catch (err) {
    if (err instanceof ZodError) {
      console.error('missing or invalid environment variables:')
      console.error(z.prettifyError(err))
      process.exit(1)
    } else {
      throw err
    }
  }
})()

mkdirSync(env.HDS_DATA_DIRECTORY, { recursive: true })
