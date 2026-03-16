import { Database } from 'bun:sqlite'
import paths from 'node:path'

import { AppBskyGraphGetRelationships } from '@atcute/bluesky'
import { ClientResponseError } from '@atcute/client'

import { type Did } from '@athidden/lexicons'

import { env } from '../env'
import { rootLogger } from '../logger'
import { Coalescer, type CoalescerRequest, Result, Semaphore, chunk, lazy } from '../util'
import { bluesky } from './client'

const relationshipLogger = rootLogger.child({ name: 'bskyRelationship' })

export interface Relationship {
  readonly a: Did
  readonly b: Did
  readonly aFollowsB: boolean
  readonly bFollowsA: boolean
  readonly aBlocksB: boolean
  readonly bBlocksA: boolean
  readonly fetchedAt: number
}

export type RelationshipResult = Result<Relationship, 'not-found'>

function flipRelationship(ship: Relationship): Relationship {
  return {
    a: ship.b,
    b: ship.a,
    aFollowsB: ship.bFollowsA,
    bFollowsA: ship.aFollowsB,
    aBlocksB: ship.bBlocksA,
    bBlocksA: ship.aBlocksB,
    fetchedAt: ship.fetchedAt,
  }
}

function canonicalizeRelationship(ship: Relationship): Relationship {
  return ship.a < ship.b ? ship : flipRelationship(ship)
}

interface CanonicalKey {
  readonly flip: boolean
  readonly key: string
  readonly a: Did
  readonly b: Did
}

function canonicalizeKey(a: Did, b: Did): CanonicalKey {
  return a < b
    ? { flip: false, key: `${a}/${b}`, a, b }
    : { flip: true, key: `${b}/${a}`, a: b, b: a }
}

const relationshipCache = lazy(() => {
  const databasePath = paths.join(env.HDS_DATA_DIRECTORY, 'relationship_cache.sqlite')

  relationshipLogger.debug({ databasePath }, 'opening database')

  const sql = new Database(databasePath, { strict: true })

  sql.run(`
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS relationships (
  a TEXT NOT NULL,
  b TEXT NOT NULL,
  a_follows_b INTEGER NOT NULL,
  b_follows_a INTEGER NOT NULL,
  a_blocks_b INTEGER NOT NULL,
  b_blocks_a INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (a, b)
) STRICT;

CREATE INDEX IF NOT EXISTS relationships_fetched_at ON relationships (fetched_at);
`)

  type RelationshipRow = {
    a: string
    b: string
    aFollowsB: number
    bFollowsA: number
    aBlocksB: number
    bBlocksA: number
    fetchedAt: number
  }

  const CACHE_TTL = Math.round(env.HDS_RELATIONSHIP_CACHE_TTL)

  const stmtGet = sql.prepare<RelationshipRow, { a: string; b: string }>(
    'SELECT a, b, ' +
      'a_follows_b AS aFollowsB, b_follows_a AS bFollowsA, ' +
      'a_blocks_b AS aBlocksB, b_blocks_a AS bBlocksA, ' +
      'fetched_at AS fetchedAt FROM relationships ' +
      `WHERE a = $a AND b = $b AND fetched_at >= (unixepoch() - ${CACHE_TTL})`,
  )

  const stmtUpsert = sql.prepare<
    void,
    {
      a: string
      b: string
      aFollowsB: number
      bFollowsA: number
      aBlocksB: number
      bBlocksA: number
    }
  >(
    'INSERT OR REPLACE INTO relationships (a, b, a_follows_b, b_follows_a, a_blocks_b, b_blocks_a, fetched_at) ' +
      'VALUES($a, $b, $aFollowsB, $bFollowsA, $aBlocksB, $bBlocksA, unixepoch())',
  )

  const stmtGc = sql.prepare(
    `DELETE FROM relationships WHERE fetched_at < (unixepoch() - ${CACHE_TTL})`,
  )

  const interval = setInterval(() => stmtGc.run(), CACHE_TTL)

  process.on('exit', () => {
    clearInterval(interval)
    stmtGet.finalize()
    stmtUpsert.finalize()
    stmtGc.finalize()
    sql.close()
    relationshipLogger.trace('closed database')
  })

  return { stmtGet, stmtUpsert }
})

const notFoundResult: RelationshipResult = Result.err('not-found')

const MAX_OTHERS_PER_REQUEST = 30

async function fetchRelationships(
  actor: Did,
  queries: Map<Did, PromiseWithResolvers<RelationshipResult>>,
): Promise<void> {
  if (queries.size < 1 || queries.size > MAX_OTHERS_PER_REQUEST) {
    relationshipLogger.warn(
      { size: queries.size },
      'fetchRelationships called with invalid query count, throwing',
    )
    throw new Error(`fetchRelationships called with invalid query count: ${queries.size}`)
  }

  try {
    // the API limits us to 30 elements in the "others" array per request
    const others = queries.keys().toArray()

    const res = await bluesky.call(AppBskyGraphGetRelationships, {
      params: { actor, others },
    })

    if (!res.ok) {
      if (res.data.error === 'ActorNotFound' || res.status === 404) {
        relationshipLogger.debug(
          { actor },
          'app.bsky.graph.getRelationships failed with ActorNotFound',
        )
        queries.forEach((resolver) => resolver.resolve(notFoundResult))
      } else {
        relationshipLogger.warn(
          { actor, error: res.data.error },
          'app.bsky.graph.getRelationships failed with unexpected error',
        )
        const err = new ClientResponseError(res)
        queries.forEach((resolver) => resolver.reject(err))
      }
      return
    }

    const { relationships } = res.data

    const fetchedAt = Date.now()

    for (const r of relationships) {
      if (r.$type === 'app.bsky.graph.defs#relationship') {
        const target = r.did

        const ship: Relationship = {
          a: actor,
          b: target,
          aFollowsB: r.following != null,
          bFollowsA: r.followedBy != null,
          aBlocksB: r.blocking != null,
          bBlocksA: r.blockedBy != null,
          fetchedAt,
        }

        const canonShip = canonicalizeRelationship(ship)
        relationshipCache().stmtUpsert.run({
          a: canonShip.a,
          b: canonShip.b,
          aFollowsB: canonShip.aFollowsB ? 1 : 0,
          bFollowsA: canonShip.bFollowsA ? 1 : 0,
          aBlocksB: canonShip.aBlocksB ? 1 : 0,
          bBlocksA: canonShip.bBlocksA ? 1 : 0,
        })

        const resolver = queries.get(target)
        if (resolver != null) {
          queries.delete(target)
          resolver.resolve(Result.ok(canonShip))
        }
      } else if (r.$type === 'app.bsky.graph.defs#notFoundActor') {
        const target = r.actor

        relationshipLogger.debug(
          { actor, target },
          'app.bsky.graph.getRelationships reported target not found',
        )

        const resolver = queries.get(target as any)
        if (resolver != null) {
          queries.delete(target as any)
          resolver.reject(notFoundResult)
        }
      }
    }

    queries.forEach((resolver) => resolver.resolve(notFoundResult))
  } catch (err: any) {
    if (!(err instanceof ClientResponseError)) {
      relationshipLogger.debug('fetchRelationships caught unknown error: ' + (err?.message || err))
    }
    queries.forEach((resolver) => resolver.reject(err))
  }
}

const ASYNC_CONCURRENCY = 5
const ASYNC_COLLECTION_DELAY_MS = 5

const fetchSemaphore = new Semaphore(ASYNC_CONCURRENCY)

type Request = CoalescerRequest<CanonicalKey, RelationshipResult>

async function performRequests(requests: Request[]) {
  const remaining = new Set(requests)

  while (remaining.size > 0) {
    const coverage = new Map<Did, Request[]>()

    for (const req of remaining) {
      for (const did of [req.params.a, req.params.b]) {
        let list = coverage.get(did)
        if (list == null) {
          list = []
          coverage.set(did, list)
        }
        list.push(req)
      }
    }

    let bestUser: Did = 'did:invalid:invalid'
    let bestList: Request[] = []
    for (const [user, list] of coverage) {
      if (list.length > bestList.length) {
        bestUser = user
        bestList = list
      }
    }

    for (const req of bestList) remaining.delete(req)

    for (const chunked of chunk(bestList, MAX_OTHERS_PER_REQUEST)) {
      const actor = bestUser
      const queries = new Map<Did, PromiseWithResolvers<RelationshipResult>>()

      // oxfmt-ignore
      for (const { params: { a, b }, resolvers } of chunked) {
        queries.set(a === actor ? b : a, resolvers)
      }

      fetchSemaphore.use(() => fetchRelationships(actor, queries))
    }
  }
}

const performCoalescer = new Coalescer<CanonicalKey, RelationshipResult>({
  action: performRequests,
  keyOf: (params) => params.key,
  delay: ASYNC_COLLECTION_DELAY_MS,
})

export async function getRelationship(a: Did, b: Did): Promise<RelationshipResult> {
  const canonKey = canonicalizeKey(a, b)

  const row = relationshipCache().stmtGet.get({ a: canonKey.a, b: canonKey.b })
  if (row != null) {
    const cached: Relationship = {
      a: row.a as Did,
      b: row.b as Did,
      aFollowsB: row.aFollowsB !== 0,
      bFollowsA: row.bFollowsA !== 0,
      aBlocksB: row.aBlocksB !== 0,
      bBlocksA: row.bBlocksA !== 0,
      fetchedAt: row.fetchedAt,
    }
    return Result.ok(cached.a === a ? cached : flipRelationship(cached))
  }

  const result = await performCoalescer.use(canonKey)
  if (result.ok && result.value.a !== a) {
    return Result.ok(flipRelationship(result.value))
  } else {
    return result
  }
}
