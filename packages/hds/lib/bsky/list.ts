import { AppBskyGraphListitem } from '@atcute/bluesky'
import { ok } from '@atcute/client'
import { BlueMicrocosmLinksGetBacklinks } from '@atcute/microcosm'

import { rootLogger } from '../logger'
import { type Did, type PubRUri, Result } from '../util'
import { constellation } from './client'
import { getPublicRecord } from './get'
import { parseUri } from './uri'

const listLogger = rootLogger.child({ name: 'bskyList' })

export type ActorOnListResult = Result<boolean, 'not-found' | 'invalid-uri'>

/* oxlint-disable no-await-in-loop */

export async function isActorOnList(actor: Did, list: PubRUri): Promise<ActorOnListResult> {
  const listUriRes = parseUri({ uri: list, type: 'public' })
  if (!listUriRes.ok) {
    return Result.mapErr(listUriRes, () => 'invalid-uri')
  }

  const listUri = listUriRes.value

  const listAuthorRes = await listUri.resolveDid()
  if (!listAuthorRes.ok) {
    return Result.mapErr(listAuthorRes, () => 'not-found')
  }

  const listAuthor: Did = listAuthorRes.value

  let currentCursor: string | null | undefined

  do {
    const { records, cursor } = await ok(
      constellation.call(BlueMicrocosmLinksGetBacklinks, {
        params: {
          source: 'app.bsky.graph.listitem:subject',
          subject: actor,
          did: [listAuthor],
          limit: 100,
          cursor: currentCursor,
        },
      }),
    )

    currentCursor = cursor

    if (records.length < 1) break

    for (const { did: repo, collection, rkey } of records) {
      if (repo !== listAuthor) {
        listLogger.debug({ repo, listAuthor }, 'constellation returned mismatched did')
        continue
      }
      if (collection !== 'app.bsky.graph.listitem') {
        listLogger.debug({ collection }, 'constellation returned wrong collection')
        continue
      }

      const logger = listLogger.child({ repo, collection, rkey })

      const recordRes = await getPublicRecord({
        repo,
        collection,
        rkey,
        schema: AppBskyGraphListitem.mainSchema,
      })
      if (!recordRes.ok) {
        logger.debug('list record lookup failed: ' + Result.toString(recordRes))
        continue
      }

      const { value: record } = recordRes.value

      const recordListUriParseRes = parseUri({ uri: record.list, type: 'public' })
      if (!recordListUriParseRes.ok) {
        logger.debug('list record has invalid list uri: ' + Result.toString(recordListUriParseRes))
        continue
      }

      const recordListUri = recordListUriParseRes.value

      if (recordListUri.collection !== 'app.bsky.graph.list') {
        logger.debug('list record has wrong list collection: ' + recordListUri.collection)
        continue
      }

      if (recordListUri.rkey !== listUri.rkey) continue

      const recordAuthorRes = await recordListUri.resolveDid()
      if (!recordAuthorRes.ok) {
        logger.debug('failed to resolve list author: ' + Result.toString(recordAuthorRes))
        continue
      }

      const recordAuthor = recordAuthorRes.value

      if (recordAuthor === listAuthor) {
        return Result.ok(true)
      }
    }
  } while (currentCursor)

  return Result.ok(false)
}
