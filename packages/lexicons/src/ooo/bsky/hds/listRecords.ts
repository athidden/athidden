import {
  array,
  document,
  integer,
  object,
  params,
  query,
  ref,
  required,
  string,
} from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hds.listRecords',
  revision: 1,
  defs: {
    main: query({
      parameters: params({
        properties: {
          repo: required(string({ format: 'at-identifier' })),
          collection: required(string({ format: 'nsid' })),
          limit: integer({ minimum: 1, maximum: 100, default: 50 }),
          cursor: string(),
        },
      }),
      output: {
        encoding: 'application/json',
        schema: object({
          properties: {
            cursor: string(),
            boxes: required(
              array({
                items: ref({ ref: 'ooo.bsky.hidden.box' }),
              }),
            ),
          },
        }),
      },
    }),
  },
})
