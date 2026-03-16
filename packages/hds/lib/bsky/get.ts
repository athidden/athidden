import { Database } from 'bun:sqlite'
import paths from 'node:path'

import { ComAtprotoRepoGetRecord } from '@atcute/atproto'
import { safeParse } from '@atcute/lexicons'
import type { ActorIdentifier, Cid, Nsid } from '@atcute/lexicons/syntax'
import type { BaseSchema, InferOutput } from '@atcute/lexicons/validations'

import { env } from '../env'
import { rootLogger } from '../logger'
import {
  type CanPubRUri,
  Dedupe,
  type PubRUri,
  type RKey,
  Result,
  isCanPubRUri,
  lazy,
} from '../util'
import { bluesky } from './client'
import { parseUri } from './uri'

const getLogger = rootLogger.child({ name: 'bskyGet' })

const recordCache = lazy(() => {
  const databasePath = paths.join(env.HDS_DATA_DIRECTORY, 'public_record_cache.sqlite')

  getLogger.debug({ databasePath }, 'opening database')

  const sql = new Database(databasePath, { strict: true })

  sql.run(`
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS records (
  repo TEXT NOT NULL,
  collection TEXT NOT NULL,
  rkey TEXT NOT NULL,
  uri TEXT NOT NULL,
  cid TEXT,
  value BLOB NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (repo, collection, rkey)
) STRICT;

CREATE INDEX IF NOT EXISTS records_fetched_at ON records (fetched_at);
`)

  type RecordRow = {
    uri: string
    cid: string | null
    value: string
  }

  const CACHE_TTL = Math.round(env.HDS_RECORD_CACHE_TTL)

  const stmtGet = sql.prepare<RecordRow, { repo: string; collection: string; rkey: string }>(
    'SELECT uri, cid, json(value) AS value FROM records ' +
      `WHERE repo = $repo AND collection = $collection AND rkey = $rkey AND fetched_at >= (unixepoch() - ${CACHE_TTL})`,
  )

  const stmtUpsert = sql.prepare<
    void,
    {
      repo: string
      collection: string
      rkey: string
      uri: string
      cid: string | null
      value: string
    }
  >(
    'INSERT OR REPLACE INTO records (repo, collection, rkey, uri, cid, value, fetched_at) ' +
      'VALUES ($repo, $collection, $rkey, $uri, $cid, jsonb($value), unixepoch())',
  )

  const stmtGc = sql.prepare(`DELETE FROM records WHERE fetched_at < (unixepoch() - ${CACHE_TTL})`)

  const interval = setInterval(() => stmtGc.run(), CACHE_TTL)

  process.on('exit', () => {
    clearInterval(interval)
    stmtGet.finalize()
    stmtUpsert.finalize()
    stmtGc.finalize()
    sql.close()
    getLogger.trace('closed database')
  })

  return { stmtGet, stmtUpsert }
})

interface RawRecordKey {
  repo: string
  collection: string
  rkey: string
}

interface RawRecord {
  uri: CanPubRUri
  cid: Cid | null
  value: unknown
}

type RawRecordResult = Result<RawRecord, 'bad-request' | 'bad-response' | 'not-found'>

async function performFetchRecord(key: RawRecordKey & { cid?: Cid }): Promise<RawRecordResult> {
  const { repo, collection, rkey } = key

  const cached = recordCache().stmtGet.get({ repo, collection, rkey })
  if (cached != null) {
    return Result.ok({
      uri: cached.uri as CanPubRUri,
      cid: (cached.cid as Cid) ?? null,
      value: JSON.parse(cached.value),
    })
  }

  const { ok, data, status } = await bluesky.call(ComAtprotoRepoGetRecord, {
    params: {
      repo: repo as ActorIdentifier,
      collection: collection as Nsid,
      rkey: rkey as RKey,
      cid: key.cid ?? undefined,
    },
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
    return Result.err('bad-response', 'bad response URI, not a canonical public URI: ' + data.uri)
  }

  const uri: CanPubRUri = data.uri
  const cid: Cid | null = data.cid ?? null

  recordCache().stmtUpsert.run({
    repo,
    collection,
    rkey,
    uri,
    cid: cid ?? null,
    value: JSON.stringify(data.value),
  })

  return Result.ok({ uri, cid, value: data.value })
}

const recordDedupe = new Dedupe<RawRecordKey, RawRecordResult>({
  perform: performFetchRecord,
  keyOf: ({ repo, collection, rkey }) => `${repo}/${collection}/${rkey}`,
})

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

  let rawResult: RawRecordResult

  if (options.cid) {
    // CID-pinned requests want an exact version, skip cache/dedup
    rawResult = await performFetchRecord({ repo, collection, rkey, cid: options.cid })
  } else {
    rawResult = await recordDedupe.use({ repo, collection, rkey })
  }

  if (!rawResult.ok) return rawResult

  const { uri, cid, value } = rawResult.value

  if (options.schema != null) {
    const validated = safeParse(options.schema, value)
    if (!validated.ok) {
      return Result.err('invalid', validated)
    } else {
      return Result.ok({ uri, cid, value: validated.value }) as GetResult<T>
    }
  }

  return Result.ok({ uri, cid, value }) as GetResult<T>
}
