import { array, blob, document, object, required } from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hidden.encryptedBlobs',
  defs: {
    main: object({
      properties: {
        blobs: required(
          array({
            items: blob(),
          }),
        ),
      },
    }),
  },
})
