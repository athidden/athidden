import {
  array,
  document,
  object,
  params,
  query,
  ref,
  required,
  string,
} from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hds.getRecords',
  defs: {
    main: query({
      parameters: params({
        properties: {
          uris: required(
            array({
              minLength: 1,
              maxLength: 50,
              items: string({ format: 'uri' }),
            }),
          ),
        },
      }),
      output: {
        encoding: 'application/json',
        schema: object({
          properties: {
            boxes: required(
              array({
                minLength: 1,
                maxLength: 50,
                items: ref({ ref: 'ooo.bsky.hidden.box' }),
              }),
            ),
          },
        }),
      },
    }),
  },
})
