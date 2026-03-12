import { document, object, procedure, required, string } from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hds.deleteAccount',
  revision: 1,
  defs: {
    main: procedure({
      input: {
        encoding: 'application/json',
        schema: object({
          properties: {
            repo: required(string({ format: 'at-identifier' })),
          },
        }),
      },
    }),
  },
})
