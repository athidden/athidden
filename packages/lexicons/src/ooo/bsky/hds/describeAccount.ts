import {
  array,
  document,
  object,
  params,
  query,
  required,
  string,
} from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hds.describeAccount',
  revision: 1,
  defs: {
    main: query({
      parameters: params({
        properties: {
          repo: required(string({ format: 'at-identifier' })),
        },
      }),
      output: {
        encoding: 'application/json',
        schema: object({
          properties: {
            did: required(string({ format: 'did' })),
            collections: required(
              array({
                items: string({ format: 'nsid' }),
              }),
            ),
          },
        }),
      },
    }),
  },
})
