import { document, object, required, string, unknown } from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hidden.box',
  revision: 1,
  defs: {
    main: object({
      properties: {
        gateUri: required(string({ format: 'uri' })),
        uri: required(string({ format: 'uri' })),
        cid: required(string({ format: 'cid' })),
        value: required(unknown()),
      },
    }),
  },
})
