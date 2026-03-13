import { document, object, record, ref, required, string, union } from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hds.admin.actorAllowlist.item',
  revision: 1,
  defs: {
    main: record({
      key: 'tid',
      record: object({
        properties: {
          value: required(
            union({
              refs: [ref({ ref: '#byActor' }), ref({ ref: '#byPds' })],
            }),
          ),
          createdAt: required(string({ format: 'datetime' })),
        },
      }),
    }),
    byActor: object({
      properties: {
        did: required(string({ format: 'did' })),
      },
    }),
    byPds: object({
      properties: {
        did: required(string({ format: 'did' })),
      },
    }),
  },
})
