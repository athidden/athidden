import { document, procedure } from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hds.importAccount',
  revision: 1,
  defs: {
    main: procedure({
      input: {
        encoding: 'application/vnd.ipld.car',
      },
    }),
  },
})
