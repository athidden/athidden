import {
  array,
  cidLink,
  document,
  object,
  ref,
  required,
  string,
} from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hidden.encryptedBlobKeys',
  defs: {
    main: object({
      properties: {
        blobKeys: required(
          array({
            items: ref({ ref: '#key' }),
          }),
        ),
      },
    }),
    key: object({
      properties: {
        ref: required(cidLink()),
        ageIdentity: required(string()),
      },
    }),
  },
})
