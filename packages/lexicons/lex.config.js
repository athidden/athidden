import { defineLexiconConfig } from '@atcute/lex-cli'

export default defineLexiconConfig({
  files: ['src/**/*.ts'],
  outdir: 'lib/',
  export: {
    outdir: '.',
  },
})
