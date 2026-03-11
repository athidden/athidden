import {
  array,
  document,
  object,
  record,
  ref,
  required,
  string,
  union,
} from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hidden.gate',
  defs: {
    main: record({
      key: 'any',
      record: object({
        properties: {
          allow: array({
            maxLength: 5,
            items: union({
              refs: [
                ref({ ref: '#mentionRule' }),
                ref({ ref: '#authorFollowsRule' }),
                ref({ ref: '#followingAuthorRule' }),
                ref({ ref: '#mutualsRule' }),
                ref({ ref: '#listRule' }),
              ],
            }),
          }),
          createdAt: required(string({ format: 'datetime' })),
        },
      }),
    }),
    mentionRule: object({
      properties: {},
    }),
    authorFollowsRule: object({
      properties: {},
    }),
    followingAuthorRule: object({
      properties: {},
    }),
    mutualsRule: object({
      properties: {},
    }),
    listRule: object({
      properties: {
        list: required(string({ format: 'uri' })),
      },
    }),
  },
})
