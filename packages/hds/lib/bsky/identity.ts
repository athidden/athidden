import { Database } from 'bun:sqlite'
import paths from 'node:path'

import { ComAtprotoIdentityResolveHandle } from '@atcute/atproto'
import { ClientResponseError } from '@atcute/client'
import {
  type DidDocument,
  getAtprotoHandle,
  getAtprotoServiceEndpoint,
  getPdsEndpoint,
} from '@atcute/identity'
import {
  AmbiguousHandleError,
  CompositeDidDocumentResolver,
  type DidDocumentResolver,
  DidNotFoundError,
  DocumentNotFoundError,
  FailedDocumentResolutionError,
  FailedHandleResolutionError,
  type HandleResolver,
  ImproperDidError,
  InvalidResolvedHandleError,
  PlcDidDocumentResolver,
  UnsupportedDidMethodError,
  WebDidDocumentResolver,
} from '@atcute/identity-resolver'
import type { ActorIdentifier, Did, Handle } from '@atcute/lexicons'
import { type AtprotoDid, isDid } from '@atcute/lexicons/syntax'

import { env } from '../env'
import { rootLogger } from '../logger'
import { Dedupe, Result, lazy, rateLimitSafeFetch } from '../util'
import { bluesky } from './client'

const identityLogger = rootLogger.child({ name: 'bskyIdentity' })

export interface Identity {
  handle: Handle
  did: Did
  didDoc: DidDocument
  pds: string | null
  hds: string | null
}

const didDocumentResolver: DidDocumentResolver = new CompositeDidDocumentResolver({
  methods: {
    plc: new PlcDidDocumentResolver({ fetch: rateLimitSafeFetch(), apiUrl: env.HDS_DID_PLC_URL }),
    web: new WebDidDocumentResolver({ fetch: rateLimitSafeFetch() }),
  },
})

const handleResolver: HandleResolver = {
  async resolve(handle: Handle, options?: { signal?: AbortSignal }): Promise<AtprotoDid> {
    const res = await bluesky.call(ComAtprotoIdentityResolveHandle, {
      params: { handle },
      signal: options?.signal ?? undefined,
    })

    const { ok, data, status } = res

    if (ok) {
      return data.did as AtprotoDid
    }

    if (status === 404 || data.error === 'HandleNotFound') {
      throw new DidNotFoundError(handle)
    } else {
      throw new FailedHandleResolutionError(handle, { cause: new ClientResponseError(res) })
    }
  },
}

const identityCache = lazy(() => {
  const databasePath = paths.join(env.HDS_DATA_DIRECTORY, 'identity_cache.sqlite')

  identityLogger.debug({ databasePath }, 'opening database')

  const sql = new Database(databasePath, { strict: true })

  sql.run(`
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS identities (
  did TEXT PRIMARY KEY NOT NULL,
  did_doc BLOB NOT NULL,
  handle TEXT NOT NULL,
  pds TEXT,
  hds TEXT,
  fetched_at INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS identities_handle ON identities (handle);
CREATE INDEX IF NOT EXISTS identities_fetched_at ON identities (fetched_at);
`)

  type IdentityRow = {
    handle: string
    did: string
    didDoc: string
    pds: string | null
    hds: string | null
  }

  const CACHE_TTL = Math.round(env.HDS_IDENTITY_CACHE_TTL)

  const stmtGetByDid = sql.prepare<IdentityRow, { did: string }>(
    'SELECT handle, did, json(did_doc) AS didDoc, pds, hds FROM identities ' +
      `WHERE did = $did AND fetched_at >= (unixepoch() - ${CACHE_TTL})`,
  )
  const stmtGetByHandle = sql.prepare<IdentityRow, { handle: string }>(
    'SELECT handle, did, json(did_doc) AS didDoc, pds, hds FROM identities ' +
      `WHERE handle = $handle AND fetched_at >= (unixepoch() - ${CACHE_TTL})`,
  )

  const stmtUpsert = sql.prepare<void, IdentityRow>(
    'INSERT OR REPLACE INTO identities (did, did_doc, handle, pds, hds, fetched_at) ' +
      'VALUES($did, jsonb($didDoc), $handle, $pds, $hds, unixepoch())',
  )

  const stmtDelete = sql.prepare<void, { did: string }>('DELETE FROM identities WHERE did = $did')

  const stmtGc = sql.prepare(
    `DELETE FROM identities WHERE fetched_at < (unixepoch() - ${CACHE_TTL})`,
  )

  const interval = setInterval(() => stmtGc.run(), CACHE_TTL)

  process.on('exit', () => {
    clearInterval(interval)
    stmtGetByDid.finalize()
    stmtGetByHandle.finalize()
    stmtUpsert.finalize()
    stmtDelete.finalize()
    stmtGc.finalize()
    sql.close()
    identityLogger.trace('closed database')
  })

  return { stmtGetByDid, stmtGetByHandle, stmtUpsert, stmtDelete }
})

export type IdentityResult = Result<Identity, 'not-found' | 'invalid' | 'failed'>

export type DidResult = Result<Did, 'not-found' | 'invalid' | 'failed'>

async function performResolveIdentity(identifier: ActorIdentifier): Promise<IdentityResult> {
  try {
    const row = isDid(identifier)
      ? identityCache().stmtGetByDid.get({ did: identifier })
      : identityCache().stmtGetByHandle.get({ handle: identifier })

    if (row != null) {
      return Result.ok({
        handle: row.handle as Handle,
        did: row.did as Did,
        didDoc: JSON.parse(row.didDoc),
        pds: row.pds,
        hds: row.hds,
      })
    }

    const identifierIsDid = isDid(identifier)

    const did: Did = identifierIsDid ? identifier : await handleResolver.resolve(identifier)

    const didDoc: DidDocument = await didDocumentResolver.resolve(did)

    const pds = getPdsEndpoint(didDoc) ?? null
    const hds =
      getAtprotoServiceEndpoint(didDoc, {
        id: '#athidden_hds',
        type: 'AthiddenHiddenDataServer',
      }) ?? null

    const reportedHandle = getAtprotoHandle(didDoc)

    let handle: Handle = 'handle.invalid'
    if (identifierIsDid) {
      if (reportedHandle) {
        try {
          const reportedHandleActualDid = await handleResolver.resolve(reportedHandle)
          if (reportedHandleActualDid === did) {
            handle = reportedHandle
          } else {
            identityLogger.debug(
              { reportedHandle, reportedHandleActualDid, did },
              'reported handle resolved to different did',
            )
          }
        } catch (err) {
          identityLogger.debug({ err, reportedHandle, did }, 'reported handle did not resolve')
        }
      }
    } else if (reportedHandle === identifier) {
      handle = reportedHandle
    }

    const identity: Identity = { handle, did, didDoc, pds, hds }

    identityCache().stmtUpsert.run({
      handle: identity.handle,
      did: identity.did,
      didDoc: JSON.stringify(identity.didDoc),
      pds: identity.pds,
      hds: identity.hds,
    })

    return Result.ok(identity)
  } catch (err: any) {
    if (
      err instanceof UnsupportedDidMethodError ||
      err instanceof ImproperDidError ||
      err instanceof InvalidResolvedHandleError ||
      err instanceof AmbiguousHandleError
    ) {
      return Result.err('invalid', err)
    }
    if (err instanceof DocumentNotFoundError || err instanceof DidNotFoundError) {
      return Result.err('not-found', err)
    }
    if (
      err instanceof FailedDocumentResolutionError ||
      err instanceof FailedHandleResolutionError
    ) {
      return Result.err('failed', err)
    }
    throw err
  }
}

const identityDedupe = new Dedupe<ActorIdentifier, IdentityResult>({
  perform: performResolveIdentity,
  keyOf: (id) => id,
})

export function resolveIdentity(identifier: ActorIdentifier): Promise<IdentityResult> {
  return identityDedupe.use(identifier)
}

export async function resolveDid(identifier: ActorIdentifier): Promise<DidResult> {
  if (isDid(identifier)) {
    return Result.ok(identifier)
  } else {
    return Result.map(await resolveIdentity(identifier), (identity) => identity.did)
  }
}

export function refreshIdentityFor(did: Did): boolean {
  const { changes } = identityCache().stmtDelete.run({ did })
  const wasDeleted = changes > 0
  identityLogger.trace({ did, wasDeleted }, 'refreshIdentityFor')
  return wasDeleted
}
