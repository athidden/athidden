import {
  boolean,
  document,
  object,
  procedure,
  required,
  string,
  unknown,
} from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hds.createRecord',
  defs: {
    main: procedure({
      input: {
        encoding: 'application/json',
        schema: object({
          properties: {
            recordUri: required(string({ format: 'uri' })),
            gateUri: required(string({ format: 'uri' })),
            record: required(unknown()),
            validate: boolean(),
            swapCommit: string({ format: 'cid' }),
          },
        }),
      },
      output: {
        encoding: 'application/json',
        schema: object({
          properties: {
            uri: required(string({ format: 'uri' })),
            cid: required(string({ format: 'cid' })),
            validationStatus: required(
              string({
                enum: ['valid', 'unknown'],
              }),
            ),
          },
        }),
      },
    }),
  },
})
