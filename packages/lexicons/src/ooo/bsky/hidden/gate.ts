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
  revision: 1,
  defs: {
    main: record({
      key: 'any',
      record: object({
        properties: {
          allow: required(
            array({
              maxLength: 5,
              items: union({
                refs: [
                  ref({ ref: '#everyoneRule' }),
                  ref({ ref: '#authorFollowsRule' }),
                  ref({ ref: '#followingAuthorRule' }),
                  ref({ ref: '#mutualsRule' }),
                  ref({ ref: '#listRule' }),
                  ref({ ref: `#actorRule` }),
                ],
              }),
            }),
          ),
          createdAt: required(string({ format: 'datetime' })),
        },
      }),
    }),
    everyoneRule: object({
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
        list: required(string({ format: 'at-uri' })),
      },
    }),
    actorRule: object({
      properties: {
        actor: required(string({ format: 'at-identifier' })),
      },
    }),
  },
})
