import type { ActorIdentifier, Did, Nsid, RecordKey } from '@atcute/lexicons'

import { hasHiddenPrefix, parseMaybeHiddenResourceUri } from '@athidden/lexicons'

import { Result } from '../util/result'
import { resolveDid } from './identity'

export type ParseUriOptions = {
  type?: 'public' | 'hidden' | 'both'
  level?: 'repo' | 'collection' | 'rkey'
  uri: string
}

export type ParsedUriResolveDidResult = Result<Did, 'not-found' | 'invalid'>

// oxfmt-ignore
export type ParsedUri<T extends ParseUriOptions> = {
  hidden: boolean
  repo: ActorIdentifier
  resolveDid: () => Promise<ParsedUriResolveDidResult>
} & (
  T['level'] extends 'collection' ? { collection: Nsid } :
  T['level'] extends 'repo' ? {} :
  { collection: Nsid; rkey: RecordKey }
)

export type ParseUriResult<T extends ParseUriOptions> = Result<
  ParsedUri<T>,
  'invalid-uri' | 'bad-uri-type' | 'missing-collection' | 'missing-rkey'
>

export function parseUri<const T extends ParseUriOptions>(options: T): ParseUriResult<T> {
  const { type, level, uri } = options

  const parsedUriResult = parseMaybeHiddenResourceUri(uri)
  if (!parsedUriResult.ok) {
    return Result.mapErr(parsedUriResult, () => 'invalid-uri')
  }

  const hidden = hasHiddenPrefix(uri)
  if ((type === 'public' && hidden) || (type === 'hidden' && !hidden)) {
    return Result.err('bad-uri-type')
  }

  const { repo, collection, rkey } = parsedUriResult.value

  if (level === 'rkey' || level == null) {
    if (!collection) return Result.err('missing-collection')
    if (!rkey) return Result.err('missing-rkey')
  } else if (level === 'collection') {
    if (!collection) return Result.err('missing-collection')
  }

  const boundResolveDid = () => resolveDid(repo)

  return Result.ok({ hidden, repo, collection, rkey, resolveDid: boundResolveDid } as any)
}
