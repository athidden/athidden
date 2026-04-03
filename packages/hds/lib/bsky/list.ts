import { Database } from 'bun:sqlite'
import paths from 'node:path'

import { AppBskyGraphListitem } from '@atcute/bluesky'
import { ClientResponseError } from '@atcute/client'
import { BlueMicrocosmLinksGetBacklinks } from '@atcute/microcosm'

import { parsedResourceUriToString } from '@athidden/lexicons'

import { env } from '../env'
import { rootLogger } from '../logger'
import { type CanPubRUri, Dedupe, type Did, type PubRUri, type RUri, Result, lazy } from '../util'
import { constellation } from './client'
import { getPublicRecord } from './get'
import { type ParsedUri, parseUri } from './uri'

const listLogger = rootLogger.child({ name: 'bskyList' })

const listCache = lazy(() => {
  const databasePath = paths.join(env.HDS_DATA_DIRECTORY, 'list_membership_cache.sqlite')

  listLogger.debug({ databasePath }, 'opening database')

  const sql = new Database(databasePath, { strict: true })

  sql.run(`
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS memberships (
  actor TEXT NOT NULL,
  list TEXT NOT NULL,
  is_member INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (actor, list)
) STRICT;

CREATE INDEX IF NOT EXISTS memberships_fetched_at ON memberships (fetched_at);
`)

  type MembershipRow = {
    actor: string
    list: string
    isMember: number
  }

  const CACHE_TTL = Math.round(env.HDS_LIST_CACHE_TTL)

  const stmtGet = sql.prepare<MembershipRow, { actor: string; list: string }>(
    'SELECT actor, list, is_member AS isMember FROM memberships ' +
      `WHERE actor = $actor AND list = $list AND fetched_at >= (unixepoch() - ${CACHE_TTL})`,
  )

  const stmtUpsert = sql.prepare<void, { actor: string; list: string; isMember: boolean }>(
    'INSERT OR REPLACE INTO memberships (actor, list, is_member, fetched_at) ' +
      'VALUES($actor, $list, $isMember, unixepoch())',
  )

  const stmtGc = sql.prepare(
    `DELETE FROM memberships WHERE fetched_at < (unixepoch() - ${CACHE_TTL})`,
  )

  const interval = setInterval(() => stmtGc.run(), CACHE_TTL)

  process.on('exit', () => {
    clearInterval(interval)
    stmtGet.finalize()
    stmtUpsert.finalize()
    stmtGc.finalize()
    sql.close()
    listLogger.trace('closed database')
  })

  return { stmtGet, stmtUpsert }
})

export type ActorOnListResult = Result<boolean, 'not-found' | 'invalid-uri'>

type MembershipKey = { actor: Did; list: PubRUri }

const listDedupe = new Dedupe<MembershipKey, ActorOnListResult>({
  perform: performIsOnList,
  keyOf: ({ actor, list }) => `${actor}/${list}`,
})

/**
 * Checks whether `actor` is a member of the given Bluesky list.
 *
 * Algorithm:
 * 1. Parse and resolve the list URI to get the list owner's DID and the list's
 *    record key.
 * 2. Query Constellation for backlinks, specifically records of type
 *    `app.bsky.graph.listitem` whose `subject` field references `actor`,
 *    authored by the list owner.
 * 3. For each candidate backlink, fetch the actual `listitem` record and
 *    verify that its `list` field points to the target list, matching both
 *    the list record key and the owner DID.
 *
 * Obviously, this means that the `listitem` and the actual list must be in
 * the same repository (so, by the same owner/author). The social-app won't let
 * you violate this, but you could break it manually.
 */
export function isOnList(actor: Did, list: PubRUri): Promise<ActorOnListResult> {
  return listDedupe.use({ actor, list })
}

async function performIsOnList(key: MembershipKey): Promise<ActorOnListResult> {
  const { actor, list } = key

  const listUriResult = parseUri({ uri: list, type: 'public' })
  if (!listUriResult.ok) {
    return Result.mapErr(listUriResult, () => 'invalid-uri')
  }

  const listUri = Result.unwrap(listUriResult)

  const listOwnerResult = await listUri.resolveDid()
  if (!listOwnerResult.ok) {
    return Result.mapErr(listOwnerResult, () => 'not-found')
  }

  const listOwner: Did = Result.unwrap(listOwnerResult)

  listUri.repo = listOwner

  const listUriString: CanPubRUri = parsedResourceUriToString(listUri)

  // check cache before asking Constellation/AppView
  const row = listCache().stmtGet.get({ actor, list: listUriString })
  if (row != null) {
    return Result.ok(row.isMember !== 0)
  }

  return queryConstellationForMembership(actor, listOwner, listUri, listUriString)
}

/*

// cache the result
listMembershipCache().stmtUpsert.run({
  actor,
  list,
  isMember: result.ok && result.value ? 1 : 0,
})*/

async function queryConstellationForMembership(
  actor: Did,
  listOwner: Did,
  listUri: ParsedUri<{ uri: RUri; type: 'public' }>,
  listUriString: CanPubRUri,
): Promise<ActorOnListResult> {
  let cursor: string | undefined

  do {
    // find listitem records that reference this actor, authored by the list owner
    const res = await constellation.call(BlueMicrocosmLinksGetBacklinks, {
      params: {
        source: 'app.bsky.graph.listitem:subject',
        subject: actor,
        did: [listOwner],
        limit: 100,
        cursor,
      },
    })

    if (!res.ok) {
      listLogger.warn(
        { error: res.data.error },
        'blue.microcosm.links.getBacklinks failed with unexpected error',
      )
      throw new ClientResponseError(res)
    }

    const { records, cursor: nextCursor } = res.data

    cursor = nextCursor ?? undefined

    if (records.length < 1) break

    // filter to valid backlink entries before fetching records
    // this shouldn't do anything but. never trust a computer
    const candidates = records.filter(({ did: repo, collection }) => {
      if (repo !== listOwner) {
        listLogger.debug({ repo, listOwner }, 'constellation returned mismatched did?')
        return false
      }
      if (collection !== 'app.bsky.graph.listitem') {
        listLogger.debug({ collection }, 'constellation returned mismatched collection?')
        return false
      }
      return true
    })

    // fetch all candidate records in parallel
    const fetchResults = await Promise.all(
      candidates.map(async ({ did: repo, collection, rkey }) => {
        const logger = listLogger.child({ repo, collection, rkey })

        const itemRecordResult = await getPublicRecord({
          repo,
          collection,
          rkey,
          schema: AppBskyGraphListitem.mainSchema,
        })
        if (!itemRecordResult.ok) {
          logger.debug('list record lookup failed: ' + Result.toString(itemRecordResult))
          return null
        }

        const { value: itemRecord } = Result.unwrap(itemRecordResult)

        // parse the list URI from the listitem record to verify it points to our target list
        const otherListUriResult = parseUri({ uri: itemRecord.list, type: 'public' })
        if (!otherListUriResult.ok) {
          logger.debug('list record has invalid list uri: ' + Result.toString(otherListUriResult))
          return null
        }

        const otherListUri = Result.unwrap(otherListUriResult)

        // collection must be 'app.bsky.graph.list'
        if (otherListUri.collection !== 'app.bsky.graph.list') {
          logger.debug('list record has wrong list collection: ' + otherListUri.collection)
          return null
        }

        // resolve the DID to confirm the listitem's list field actually belongs to the same owner
        const otherListOwnerResult = await otherListUri.resolveDid()
        if (!otherListOwnerResult.ok) {
          logger.debug('failed to resolve list author: ' + Result.toString(otherListOwnerResult))
          return null
        }

        const otherListOwner: Did = Result.unwrap(otherListOwnerResult)

        // owner must be the same as the list owner
        if (otherListOwner !== listOwner) {
          logger.debug('list owner does not match: ' + otherListOwner + ' !== ' + listOwner)
          return null
        }

        otherListUri.repo = otherListOwner

        const otherListUriString: CanPubRUri = parsedResourceUriToString(otherListUri)

        // we know that we are on itemList, but we don't know if itemList is *the* list we're looking for
        // cache this successful result
        listCache().stmtUpsert.run({ actor, list: otherListUriString, isMember: 1 })

        // check if this is the list we're looking for
        return listUriString === otherListUriString
      }),
    )

    if (fetchResults.some((result) => result === true)) {
      return Result.ok(true)
    }
  } while (cursor)

  listCache().stmtUpsert.run({ actor, list: listUriString, isMember: 0 })

  return Result.ok(false)
}
