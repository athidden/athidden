import { boolean, document, object, record, required, string } from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hds.admin.account',
  revision: 1,
  defs: {
    main: record({
      key: 'tid',
      record: object({
        properties: {
          did: required(string({ format: 'did' })),
          createdAt: required(string({ format: 'datetime' })),
          isAdmin: boolean(),
          banReason: string(),
        },
      }),
    }),
  },
})
