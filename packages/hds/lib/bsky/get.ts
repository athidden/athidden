import { ComAtprotoRepoGetRecord } from '@atcute/atproto'
import { safeParse } from '@atcute/lexicons'
import type { ActorIdentifier, Cid, Nsid } from '@atcute/lexicons/syntax'
import type { BaseSchema, InferOutput } from '@atcute/lexicons/validations'

import { type CanPubRUri, type PubRUri, type RKey, Result, isCanPubRUri } from '../util'
import { bluesky } from './client'
import { parseUri } from './uri'

export type GetOptions<T extends BaseSchema> = (
  | { uri: PubRUri }
  | { repo: ActorIdentifier; collection: Nsid; rkey: RKey }
) & { cid?: Cid; schema?: T }

export interface GetResponse<T> {
  uri: CanPubRUri
  cid: Cid | null
  value: T extends BaseSchema ? InferOutput<T> : unknown
}

export type GetResult<T> = Result<
  GetResponse<T>,
  'bad-request' | 'bad-response' | 'not-found' | 'invalid'
>

export async function getPublicRecord<const T extends BaseSchema>(
  options: GetOptions<T>,
): Promise<GetResult<T>> {
  let repo: ActorIdentifier
  let collection: Nsid
  let rkey: RKey

  if ('uri' in options) {
    const { uri } = options

    const parseRes = parseUri({ uri, type: 'public' })
    if (!parseRes.ok) {
      return Result.mapErr(parseRes, () => 'bad-request')
    }

    const parsed = parseRes.value

    repo = parsed.repo
    collection = parsed.collection
    rkey = parsed.rkey
  } else {
    repo = options.repo
    collection = options.collection
    rkey = options.rkey
  }

  const { ok, data, status } = await bluesky.call(ComAtprotoRepoGetRecord, {
    params: { repo, collection, rkey, cid: options.cid || undefined },
  })

  if (!ok) {
    if (data.error === 'RecordNotFound' || status === 404) {
      return Result.err('not-found')
    } else if (status >= 400 && status < 500) {
      return Result.err('bad-request', data.error)
    } else {
      return Result.err('bad-response', data.error)
    }
  }

  if (!isCanPubRUri(data.uri)) {
    const message = 'bad response URI, not a canonical public URI: ' + data.uri
    return Result.err('bad-response', message)
  }

  const uri: CanPubRUri = data.uri
  const cid: Cid | null = data.cid ?? null

  const { schema } = options

  if (schema != null) {
    const validated = safeParse(schema, data.value)
    if (!validated.ok) {
      return Result.err('invalid', validated)
    } else {
      return Result.ok({ uri, cid, value: validated.value }) as GetResult<T>
    }
  } else {
    return Result.ok({ uri, cid, value: data.value }) as GetResult<T>
  }
}
