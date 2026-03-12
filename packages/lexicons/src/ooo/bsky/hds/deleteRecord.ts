import { document, object, procedure, required, string } from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hds.deleteRecord',
  revision: 1,
  defs: {
    main: procedure({
      input: {
        encoding: 'application/json',
        schema: object({
          properties: {
            repo: required(string({ format: 'at-identifier' })),
            collection: required(string({ format: 'nsid' })),
            rkey: required(string({ format: 'record-key' })),
            swapRecord: string({ format: 'cid' }),
          },
        }),
      },
      errors: [{ name: 'InvalidSwap' }],
    }),
  },
})
