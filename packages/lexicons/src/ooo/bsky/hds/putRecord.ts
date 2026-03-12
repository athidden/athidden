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
  id: 'ooo.bsky.hds.putRecord',
  revision: 1,
  defs: {
    main: procedure({
      input: {
        encoding: 'application/json',
        schema: object({
          properties: {
            repo: required(string({ format: 'at-identifier' })),
            collection: required(string({ format: 'nsid' })),
            rkey: required(string({ format: 'record-key' })),
            gateUri: required(string({ format: 'uri' })),
            record: required(unknown()),
            validate: boolean(),
            swapRecord: string({ format: 'cid' }),
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
      errors: [{ name: 'InvalidSwap' }],
    }),
  },
})
