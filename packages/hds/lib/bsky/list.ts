import { Database } from 'bun:sqlite'
import paths from 'node:path'

import { AppBskyGraphListitem } from '@atcute/bluesky'
import { BlueMicrocosmLinksGetBacklinks } from '@atcute/microcosm'

import { env } from '../env'
import { rootLogger } from '../logger'
import { Dedupe, type Did, type PubRUri, Result, lazy } from '../util'
import { asResult, constellation } from './client'
import { getPublicRecord } from './get'
import { parseUri } from './uri'

const listLogger = rootLogger.child({ name: 'bskyList' })

const listMembershipCache = lazy(() => {
  const databasePath = paths.join(env.HDS_DATA_DIRECTORY, 'list_membership_cache.sqlite')

  listLogger.debug({ databasePath }, 'opening database')

  const sql = new Database(databasePath, { strict: true })

  sql.run(`
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS list_memberships (
  actor TEXT NOT NULL,
  list TEXT NOT NULL,
  is_member INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (actor, list)
) STRICT;

CREATE INDEX IF NOT EXISTS list_memberships_fetched_at ON list_memberships (fetched_at);
`)

  type MembershipRow = {
    actor: string
    list: string
    isMember: number
  }

  const CACHE_TTL = Math.round(env.HDS_LIST_CACHE_TTL)

  const stmtGet = sql.prepare<MembershipRow, { actor: string; list: string }>(
    'SELECT actor, list, is_member AS isMember FROM list_memberships ' +
      `WHERE actor = $actor AND list = $list AND fetched_at >= (unixepoch() - ${CACHE_TTL})`,
  )

  const stmtUpsert = sql.prepare<void, { actor: string; list: string; isMember: number }>(
    'INSERT OR REPLACE INTO list_memberships (actor, list, is_member, fetched_at) ' +
      'VALUES($actor, $list, $isMember, unixepoch())',
  )

  const stmtGc = sql.prepare(
    `DELETE FROM list_memberships WHERE fetched_at < (unixepoch() - ${CACHE_TTL})`,
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

export type ActorOnListResult = Result<boolean, 'not-found' | 'invalid-uri' | 'failed'>

/**
 * Checks whether `actor` is a member of the given Bluesky list.
 *
 * Algorithm:
 * 1. Parse and resolve the list URI to get the list owner's DID and rkey.
 * 2. Query Constellation for backlinks - records of type
 *    `app.bsky.graph.listitem` whose `subject` field references `actor`,
 *    authored by the list owner.
 * 3. For each candidate backlink, fetch the actual listitem record and verify
 *    that its `list` field points to the target list - matching both rkey and
 *    owner DID.
 */

type ListMembershipKey = { actor: Did; list: PubRUri }

const listDedupe = new Dedupe<ListMembershipKey, ActorOnListResult>({
  perform: performIsActorOnList,
  keyOf: ({ actor, list }) => `${actor}/${list}`,
})

export function isActorOnList(actor: Did, list: PubRUri): Promise<ActorOnListResult> {
  return listDedupe.use({ actor, list })
}

async function performIsActorOnList(key: ListMembershipKey): Promise<ActorOnListResult> {
  const { actor, list } = key

  const parsedListResult = parseUri({ uri: list, type: 'public' })
  if (!parsedListResult.ok) {
    return Result.mapErr(parsedListResult, () => 'invalid-uri')
  }

  const parsedList = parsedListResult.value

  const listOwnerResult = await parsedList.resolveDid()
  if (!listOwnerResult.ok) {
    return Result.mapErr(listOwnerResult, () => 'not-found')
  }

  const listOwner: Did = listOwnerResult.value

  // check cache before asking Constellation/AppView
  const cached = listMembershipCache().stmtGet.get({ actor, list })
  if (cached != null) {
    return Result.ok(cached.isMember !== 0)
  }

  const result = await queryConstellationForMembership(actor, listOwner, parsedList.rkey)

  // cache the result
  listMembershipCache().stmtUpsert.run({
    actor,
    list,
    isMember: result.ok && result.value ? 1 : 0,
  })

  return result
}

/* oxlint-disable no-await-in-loop */

/**
 * Queries Constellation backlinks and verifies candidate `listitem` records.
 * Pages through results until a match is found or all candidates are exhausted.
 */
async function queryConstellationForMembership(
  actor: Did,
  listOwner: Did,
  listRkey: string,
): Promise<ActorOnListResult> {
  let cursor: string | undefined

  do {
    // find listitem records that reference this actor, authored by the list owner
    const backlinksResult = await asResult(
      constellation.call(BlueMicrocosmLinksGetBacklinks, {
        params: {
          source: 'app.bsky.graph.listitem:subject',
          subject: actor,
          did: [listOwner],
          limit: 100,
          cursor,
        },
      }),
    )

    if (!backlinksResult.ok) {
      listLogger.warn({ error: backlinksResult.error }, 'constellation backlinks query failed')
      return Result.err('failed')
    }

    const { records, cursor: nextCursor } = backlinksResult.value
    cursor = nextCursor ?? undefined

    if (records.length < 1) break

    // filter to valid backlink entries before fetching records
    // this shouldn't do anything but like. never trust a computer
    const candidates = records.filter(({ did: repo, collection }) => {
      if (repo !== listOwner) {
        listLogger.debug({ repo, listOwner }, 'constellation returned mismatched did')
        return false
      }
      if (collection !== 'app.bsky.graph.listitem') {
        listLogger.debug({ collection }, 'constellation returned wrong collection')
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

        const listItem = itemRecordResult.value.value

        // parse the list URI from the listitem record to verify it points to our target list
        const itemListResult = parseUri({ uri: listItem.list, type: 'public' })
        if (!itemListResult.ok) {
          logger.debug('list record has invalid list uri: ' + Result.toString(itemListResult))
          return null
        }

        const itemList = itemListResult.value

        if (itemList.collection !== 'app.bsky.graph.list') {
          logger.debug('list record has wrong list collection: ' + itemList.collection)
          return null
        }

        if (itemList.rkey !== listRkey) return null

        // resolve the DID to confirm the listitem's list field actually
        // belongs to the same owner (handles vs DIDs may differ in the URI)
        const itemListOwnerResult = await itemList.resolveDid()
        if (!itemListOwnerResult.ok) {
          logger.debug('failed to resolve list author: ' + Result.toString(itemListOwnerResult))
          return null
        }

        return itemListOwnerResult.value === listOwner
      }),
    )

    if (fetchResults.some((result) => result === true)) {
      return Result.ok(true)
    }
  } while (cursor)

  return Result.ok(false)
}
