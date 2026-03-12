import { document, procedure } from '@atcute/lexicon-doc/builder'

export default document({
  id: 'ooo.bsky.hds.exportAccount',
  revision: 1,
  defs: {
    main: procedure({
      output: {
        encoding: 'application/vnd.ipld.car',
      },
    }),
  },
})
