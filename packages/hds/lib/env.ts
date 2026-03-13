import { z } from 'zod'

export type Env = z.infer<typeof Env>
export const Env = z.object({
  HDS_HOSTNAME: z.string().nonempty().default('localhost'),
  HDS_DATA_DIRECTORY: z.string().nonempty().default('./data'),
  HDS_OWNER_DID: z.string().startsWith('did:').default('did:plc:fusxjk227zn4qcbrll5xa77m'),
  HDS_DID_PLC_URL: z.url().default('https://plc.directory'),
})

export const env = Env.parse(Bun.env)
