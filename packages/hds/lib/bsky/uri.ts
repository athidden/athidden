import type { ActorIdentifier, Did, Nsid, RecordKey } from '@atcute/lexicons'
import { isDid } from '@atcute/lexicons/syntax'

import { hasHiddenPrefix, parseMaybeHiddenResourceUri } from '@athidden/lexicons'

import { Result } from '../util/result'
import { resolveIdentity } from './identity'

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

  const parseRes = parseMaybeHiddenResourceUri(uri)
  if (!parseRes.ok) {
    return Result.mapErr(parseRes, () => 'invalid-uri')
  }

  const hidden = hasHiddenPrefix(uri)
  if ((type === 'public' && hidden) || (type === 'hidden' && !hidden)) {
    return Result.err('bad-uri-type')
  }

  const { repo, collection, rkey } = parseRes.value

  if (level === 'rkey' || level == null) {
    if (!collection) return Result.err('missing-collection')
    if (!rkey) return Result.err('missing-rkey')
  } else if (level === 'collection') {
    if (!collection) return Result.err('missing-collection')
  }

  const resolveDid = async () => {
    if (isDid(repo)) {
      return Result.ok(repo)
    } else {
      return Result.map(await resolveIdentity(repo), (value) => value.did)
    }
  }

  return Result.ok({ hidden, repo, collection, rkey, resolveDid } as any)
}
