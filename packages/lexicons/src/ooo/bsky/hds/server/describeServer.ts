import { document, object, query, ref, required, string } from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hds.server.describeServer',
  revision: 1,
  defs: {
    main: query({
      output: {
        encoding: 'application/json',
        schema: object({
          properties: {
            did: required(string({ format: 'did' })),
            links: ref({ ref: '#links' }),
            contact: ref({ ref: '#contact' }),
            description: string(),
          },
        }),
      },
    }),
    links: object({
      properties: {
        privacyPolicy: string({ format: 'uri' }),
        termsOfService: string({ format: 'uri' }),
      },
    }),
    contact: object({
      properties: {
        url: string({ format: 'uri' }),
        email: string(),
      },
    }),
  },
})
