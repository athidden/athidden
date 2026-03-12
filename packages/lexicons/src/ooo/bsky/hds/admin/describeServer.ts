import { document, object, query, ref, required, string } from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hds.admin.describeServer',
  revision: 1,
  defs: {
    main: query({
      output: {
        encoding: 'application/json',
        schema: object({
          properties: {
            did: required(string({ format: 'did' })),
            owner: required(string({ format: 'did' })),
            description: string(),
            links: ref({ ref: '#links' }),
            contact: ref({ ref: '#contact' }),
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
