import { isDid } from '@atcute/lexicons/syntax'

import { z } from 'zod'

export type Env = z.infer<typeof Env>
export const Env = z.object({
  HDS_DATA_DIRECTORY: z.string().nonempty().default('./data'),
  HDS_HOSTNAME: z.string().nonempty(),
  HDS_OWNER_DID: z.string().refine(isDid),
  HDS_DID_PLC_URL: z.url().default('https://plc.directory'),
})

export const env = Env.parse(Bun.env)
