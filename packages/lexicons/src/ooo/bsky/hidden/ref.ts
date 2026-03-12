import { document, object, required, string } from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hidden.ref',
  revision: 1,
  defs: {
    main: object({
      properties: {
        boxUri: required(
          string({
            format: 'uri',
          }),
        ),
        valueCid: required(
          string({
            format: 'cid',
          }),
        ),
      },
    }),
  },
})
