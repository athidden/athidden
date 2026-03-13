import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import fs from 'node:fs/promises'
import paths from 'node:path'

import { type Cid, type Did, type Nsid } from '@athidden/lexicons'

import { z } from 'zod'

import { env } from './env'
import { rootLogger } from './index'
import {
  Box,
  type CanRUri,
  type RKey,
  type Result,
  cborDecode,
  cidBlob2String,
  cidString2Blob,
  pick,
  zCanRUri,
  zCid,
  zDid,
  zNsid,
  zRKey,
  zUint8Array,
} from './utils'

const SQL_SCHEMA = `
CREATE TABLE IF NOT EXISTS records (
  collection TEXT NOT NULL,
  rkey TEXT NOT NULL,
  gate_uri TEXT NOT NULL,
  cid BLOB NOT NULL,
  value BLOB NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (collection, rkey)
) STRICT;

CREATE INDEX IF NOT EXISTS records_collection ON records (collection);
CREATE INDEX IF NOT EXISTS records_cursor ON records (created_at DESC, collection DESC, rkey DESC);
`

const SQL_PRAGMAS = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
`

function prepareStatements(db: Database) {
  const getRecord = db.prepare<
    { gateUri: string; cid: Uint8Array; value: Uint8Array },
    { collection: string; rkey: string }
  >(
    'SELECT gate_uri AS gateUri, cid, value FROM records WHERE collection = $collection AND rkey = $rkey',
  )

  const checkCid = db.prepare<1, { collection: string; rkey: string; swapCid: Uint8Array }>(
    'SELECT 1 FROM records WHERE collection = $collection AND rkey = $rkey AND cid = $swapCid',
  )

  const createRecord = db.prepare<
    void,
    { collection: string; rkey: string; gateUri: string; cid: Uint8Array; value: Uint8Array }
  >(
    'INSERT INTO records (collection, rkey, gate_uri, cid, value) VALUES ($collection, $rkey, $gateUri, $cid, $value)',
  )

  const upsertRecord = db.prepare<
    void,
    { collection: string; rkey: string; gateUri: string; cid: Uint8Array; value: Uint8Array }
  >(
    'INSERT OR REPLACE INTO records (collection, rkey, gate_uri, cid, value) VALUES ($collection, $rkey, $gateUri, $cid, $value)',
  )

  const deleteRecord = db.prepare<void, { collection: string; rkey: string }>(
    'DELETE FROM records WHERE collection = $collection AND rkey = $rkey',
  )

  const checkCidAndDeleteRecord = db.prepare<
    void,
    { collection: string; rkey: string; swapCid: Uint8Array }
  >('DELETE FROM records WHERE collection = $collection AND rkey = $rkey AND cid = $swapCid')

  const listRecords = db.prepare<
    {
      collection: string
      rkey: string
      gateUri: string
      cid: Uint8Array
      value: Uint8Array
      createdAt: number
    },
    { collection: string; limit: number }
  >(
    'SELECT collection, rkey, gate_uri AS gateUri, cid, value, created_at AS createdAt FROM records ' +
      'WHERE collection = $collection ORDER BY created_at DESC, rkey DESC LIMIT $limit',
  )

  const listRecordsCursor = db.prepare<
    {
      collection: string
      rkey: string
      gateUri: string
      cid: Uint8Array
      value: Uint8Array
      createdAt: number
    },
    { collection: string; createdAt: number; rkey: string; limit: number }
  >(
    'SELECT collection, rkey, gate_uri AS gateUri, cid, value, created_at AS createdAt FROM records ' +
      'WHERE collection = $collection AND (created_at, rkey) < ($createdAt, $rkey) ORDER BY created_at DESC, rkey DESC LIMIT $limit',
  )

  const exportRecords = db.prepare<
    {
      collection: string
      rkey: string
      gateUri: string
      cid: Uint8Array
      value: Uint8Array
      createdAt: number
    },
    { limit: number }
  >(
    'SELECT collection, rkey, gate_uri AS gateUri, cid, value, created_at AS createdAt FROM records ' +
      'ORDER BY created_at DESC, collection DESC, rkey DESC LIMIT $limit',
  )

  const exportRecordsCursor = db.prepare<
    {
      collection: string
      rkey: string
      gateUri: string
      cid: Uint8Array
      value: Uint8Array
      createdAt: number
    },
    { createdAt: number; collection: string; rkey: string; limit: number }
  >(
    'SELECT collection, rkey, gate_uri AS gateUri, cid, value, created_at AS createdAt FROM records ' +
      'WHERE (created_at, collection, rkey) < ($createdAt, $collection, $rkey) ORDER BY created_at DESC, collection DESC, rkey DESC LIMIT $limit',
  )

  const listCollections = db.prepare<{ collection: string }, { limit: number }>(
    'SELECT DISTINCT collection FROM records ORDER BY collection ASC LIMIT $limit',
  )

  const listCollectionsCursor = db.prepare<
    { collection: string },
    { collection: string; limit: number }
  >(
    'SELECT DISTINCT collection FROM records WHERE collection > $collection ORDER BY collection ASC LIMIT $limit',
  )

  const importRecord = db.prepare<
    void,
    {
      collection: string
      rkey: string
      gateUri: string
      cid: Uint8Array
      value: Uint8Array
      createdAt: number
    }
  >(
    'INSERT OR REPLACE INTO records (collection, rkey, gate_uri, cid, value, created_at) VALUES ($collection, $rkey, $gateUri, $cid, $value, $createdAt)',
  )

  function finalizeAll(): void {
    getRecord.finalize()
    checkCid.finalize()
    createRecord.finalize()
    upsertRecord.finalize()
    deleteRecord.finalize()
    checkCidAndDeleteRecord.finalize()
    listRecords.finalize()
    listRecordsCursor.finalize()
    exportRecords.finalize()
    exportRecordsCursor.finalize()
    listCollections.finalize()
    listCollectionsCursor.finalize()
    importRecord.finalize()
  }

  return {
    getRecord,
    checkCid,
    createRecord,
    upsertRecord,
    deleteRecord,
    checkCidAndDeleteRecord,
    listRecords,
    listRecordsCursor,
    exportRecords,
    exportRecordsCursor,
    listCollections,
    listCollectionsCursor,
    importRecord,
    finalizeAll,
  }
}

function getDatabaseDirectoryPath(did: Did): string {
  const hash = (BigInt(Bun.hash(did)) & 0xffn).toString(16).padStart(2, '0')
  return paths.join(env.HDS_DATA_DIRECTORY, hash, did)
}

function getDatabaseFilePath(did: Did): string {
  return paths.join(getDatabaseDirectoryPath(did), 'records.sqlite')
}

export async function hasDatabaseFor(did: Did): Promise<boolean> {
  did = zDid.parse(did)
  try {
    return await fs.exists(getDatabaseFilePath(did))
  } catch (err) {
    rootLogger.error({ err, did }, 'hasDatabaseFor failed')
  }
  return false
}

export async function deleteDatabaseFor(did: Did): Promise<boolean> {
  did = zDid.parse(did)
  try {
    await fs.rm(getDatabaseDirectoryPath(did), { recursive: true, force: true })
    return true
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      rootLogger.debug({ err, did }, 'deleteDatabaseFor directory not found')
    } else {
      rootLogger.error({ err, did }, 'deleteDatabaseFor failed')
    }
  }
  return false
}

function openDatabaseFor(did: Did): Database {
  const logger = rootLogger.child({ did })

  const dirPath = getDatabaseDirectoryPath(did)
  const filePath = getDatabaseFilePath(did)

  try {
    mkdirSync(dirPath, { recursive: true })
  } catch (err) {
    const message = 'openDatabaseFor mkdir failed'
    logger.error({ err, dirPath }, message)
    throw Object.assign(new Error(message, { cause: err }), { did, dirPath })
  }

  let db: Database

  try {
    db = new Database(filePath, { strict: true })
  } catch (err: any) {
    const message = 'openDatabaseFor open failed: ' + err?.message
    logger.error({ err, filePath }, message)
    throw Object.assign(new Error(message, { cause: err }), { did, filePath })
  }

  try {
    db.run(SQL_PRAGMAS)
  } catch (err: any) {
    const message = 'openDatabaseFor run pragmas failed: ' + err?.message
    logger.error({ err }, message)
    throw Object.assign(new Error(message, { cause: err }), { did })
  }

  try {
    db.run(SQL_SCHEMA)
  } catch (err: any) {
    const message = 'openDatabaseFor run schema failed: ' + err?.message
    logger.error({ err }, message)
    throw Object.assign(new Error(message, { cause: err }), { did })
  }

  return db
}

export interface StoreRecord {
  collection: Nsid
  rkey: RKey
  gateUri: CanRUri
  cid: Uint8Array
  value: Uint8Array
  createdAt: number
}
export const StoreRecord = z.object({
  collection: zNsid,
  rkey: zRKey,
  gateUri: zCanRUri,
  cid: zUint8Array,
  value: zUint8Array,
  createdAt: z.int(),
})

export interface StoreGetRecordParams {
  collection: Nsid
  rkey: RKey
}
export const StoreGetRecordParams = z.object({
  collection: zNsid,
  rkey: zRKey,
})

export interface StoreUpsertRecordParams {
  collection: Nsid
  rkey: RKey
  gateUri: CanRUri
  encodedCid: Uint8Array
  encodedValue: Uint8Array
  create?: boolean
  swapCid?: Cid
}
export const StoreUpsertRecordParams = z.object({
  collection: zNsid,
  rkey: zRKey,
  gateUri: zCanRUri,
  encodedCid: zUint8Array,
  encodedValue: zUint8Array,
  create: z.boolean().optional(),
  swapCid: zCid.optional(),
})

export interface StoreDeleteRecordParams {
  collection: Nsid
  rkey: RKey
  swapCid?: Cid
}
export const StoreDeleteRecordParams = z.object({
  collection: zNsid,
  rkey: zRKey,
  swapCid: zCid.optional(),
})

export type StoreLimitAndCursor = z.infer<typeof StoreLimitAndCursor>
export const StoreLimitAndCursor = z.object({
  limit: z.int().min(1).optional().default(50),
  cursor: z.string().nonempty().optional(),
})

export interface StoreListRecordsParams extends StoreLimitAndCursor {
  collection: Nsid
}
export const StoreListRecordsParams = StoreLimitAndCursor.extend({
  collection: zNsid,
})

export interface StoreImportRecordsParams {
  records: StoreRecord[]
}
export const StoreImportRecordsParams = z.object({
  records: z.array(StoreRecord),
})

export class Store {
  readonly did: Did

  readonly #db: Database
  readonly #stmts: ReturnType<typeof prepareStatements>

  readonly #logger: typeof rootLogger

  #lastUsed: number
  #isClosed: boolean

  constructor(did: Did) {
    did = zDid.parse(did)

    const db = openDatabaseFor(did)
    const stmts = prepareStatements(db)

    const logger = rootLogger.child({ did })

    this.did = did
    this.#db = db
    this.#stmts = stmts
    this.#logger = logger
    this.#lastUsed = Date.now()
    this.#isClosed = false

    logger.debug('store ready!')
  }

  close(): void {
    if (!this.#isClosed) {
      this.#isClosed = true
      try {
        this.#stmts.finalizeAll()
      } catch (err) {
        this.#logger.warn({ err }, 'store close: failed to finalize statements')
      }
      try {
        this.#db.close(true)
      } catch (err) {
        this.#logger.warn({ err }, 'store close: failed to close db')
      }
      this.#logger.debug('store closed!')
    }
  }

  get repo(): Did {
    return this.did
  }

  get millisSinceLastUsed(): number {
    return Date.now() - this.#lastUsed
  }

  get isClosed(): boolean {
    return this.#isClosed
  }

  #updateLastUsed(): void {
    this.#lastUsed = Date.now()
  }

  #performAction<T>(name: string, params: any, action: () => T): T {
    if (this.#isClosed) {
      throw new Error(`store ${name} is closed`)
    }
    this.#updateLastUsed()
    try {
      return action()
    } catch (err: any) {
      const message = `store ${name}: ${err?.message || err}`
      const context = pick(params, ['collection', 'rkey', 'create', 'swapCid'])
      this.#logger.error({ err, ...context }, message)
      throw Object.assign(new Error(message), { did: this.did, ...context })
    }
  }

  getRecord(params: StoreGetRecordParams): Result<Box, 'invalid' | 'not-found'> {
    return this.#performAction('getRecord', params, () => {
      // oxfmt-ignore
      const { collection, rkey } =
        StoreGetRecordParams.parse(params) satisfies StoreGetRecordParams

      const result = this.#stmts.getRecord.get({ collection, rkey })
      if (result == null) {
        return { ok: false, error: 'not-found' }
      }

      const box: Box = Box.parse({
        gateUri: result.gateUri,
        uri: `athidden://${this.did}/${collection}/${rkey}`,
        cid: cidBlob2String(result.cid),
        value: cborDecode(result.value),
      })

      return { ok: true, value: box }
    })
  }

  upsertRecord(params: StoreUpsertRecordParams): Result<void, 'conflict'> {
    return this.#performAction('upsertRecord', params, () => {
      // oxfmt-ignore
      const { collection, rkey, gateUri, encodedCid, encodedValue, create, swapCid } =
        StoreUpsertRecordParams.parse(params) satisfies StoreUpsertRecordParams

      const encodedSwapCid = swapCid != null ? cidString2Blob(swapCid) : null

      const tx = this.#db.transaction((): Result<void, 'conflict'> => {
        if (encodedSwapCid != null) {
          const doCidsMatch = this.#stmts.checkCid.get({
            collection,
            rkey,
            swapCid: encodedSwapCid,
          })
          if (doCidsMatch !== 1) {
            return { ok: false, error: 'conflict' }
          }
        }

        const values = {
          collection,
          rkey,
          gateUri,
          cid: encodedCid,
          value: encodedValue,
        }
        if (create) {
          this.#stmts.createRecord.run(values)
        } else {
          this.#stmts.upsertRecord.run(values)
        }

        return { ok: true, value: undefined }
      })

      return tx.immediate()
    })
  }

  deleteRecord(params: StoreDeleteRecordParams): Result<void, 'not-found' | 'conflict'> {
    return this.#performAction('deleteRecord', params, () => {
      // oxfmt-ignore
      const { collection, rkey, swapCid } =
        StoreDeleteRecordParams.parse(params) satisfies StoreDeleteRecordParams

      if (swapCid != null) {
        const { changes } = this.#stmts.checkCidAndDeleteRecord.run({
          collection,
          rkey,
          swapCid: cidString2Blob(swapCid),
        })
        if (changes < 1) {
          return { ok: false, error: 'conflict' }
        }
      } else {
        const { changes } = this.#stmts.deleteRecord.run({ collection, rkey })
        if (changes < 1) {
          return { ok: false, error: 'not-found' }
        }
      }

      return { ok: true, value: undefined }
    })
  }

  listRecords(params: StoreListRecordsParams): { boxes: Box[]; cursor?: string } {
    return this.#performAction('listRecords', params, () => {
      // oxfmt-ignore
      const { collection, limit, cursor } =
        StoreListRecordsParams.parse(params) satisfies StoreListRecordsParams

      let rows
      if (cursor != null) {
        const [createdAt, rkey] = z.tuple([z.coerce.number().int(), zRKey]).parse(cursor.split('/'))
        rows = this.#stmts.listRecordsCursor.all({ collection, createdAt, rkey, limit })
      } else {
        rows = this.#stmts.listRecords.all({ collection, limit })
      }

      const boxes: Box[] = rows.map((row) =>
        Box.parse({
          gateUri: row.gateUri,
          uri: `athidden://${this.did}/${row.collection}/${row.rkey}`,
          cid: cidBlob2String(row.cid),
          value: cborDecode(row.value),
        }),
      )

      let nextCursor: string | undefined

      if (rows.length === limit) {
        const last = rows[rows.length - 1]
        nextCursor = `${last!.createdAt}/${last!.rkey}`
      }

      return { boxes, cursor: nextCursor }
    })
  }

  listCollections(params: StoreLimitAndCursor): { collections: Nsid[]; cursor?: string } {
    return this.#performAction('listCollections', params, () => {
      // oxfmt-ignore
      const { limit, cursor } =
        StoreLimitAndCursor.parse(params) satisfies StoreLimitAndCursor

      let rows
      if (cursor != null) {
        rows = this.#stmts.listCollectionsCursor.all({ collection: cursor, limit })
      } else {
        rows = this.#stmts.listCollections.all({ limit })
      }

      const collections = rows.map((row) => zNsid.parse(row.collection))

      let nextCursor: string | undefined

      if (rows.length === limit) {
        nextCursor = rows[rows.length - 1]!.collection
      }

      return { collections, cursor: nextCursor }
    })
  }

  exportRecords(params: StoreLimitAndCursor): { records: StoreRecord[]; cursor?: string } {
    return this.#performAction('exportRecords', params, () => {
      // oxfmt-ignore
      const { limit, cursor } =
        StoreLimitAndCursor.parse(params) satisfies StoreLimitAndCursor

      let rows
      if (cursor != null) {
        const [createdAt, collection, rkey] = z
          .tuple([z.coerce.number().int(), zNsid, zRKey])
          .parse(cursor.split('/'))
        rows = this.#stmts.exportRecordsCursor.all({ createdAt, collection, rkey, limit })
      } else {
        rows = this.#stmts.exportRecords.all({ limit })
      }

      const records: StoreRecord[] = rows.map((row) =>
        StoreRecord.parse({
          collection: row.collection,
          rkey: row.rkey,
          gateUri: row.gateUri,
          cid: row.cid,
          value: row.value,
          createdAt: row.createdAt,
        }),
      )

      let nextCursor: string | undefined

      if (rows.length === limit) {
        const last = rows[rows.length - 1]
        nextCursor = `${last!.createdAt}/${last!.collection}/${last!.rkey}`
      }

      return { records, cursor: nextCursor }
    })
  }

  importRecords(params: { records: StoreRecord }): void {
    this.#performAction('importRecords', params, () => {
      // oxfmt-ignore
      const { records } =
        StoreImportRecordsParams.parse(params) satisfies StoreImportRecordsParams

      const tx = this.#db.transaction(() => {
        for (const record of records) {
          this.#stmts.importRecord.run({
            collection: record.collection,
            rkey: record.rkey,
            gateUri: record.gateUri,
            cid: record.cid,
            value: record.value,
            createdAt: record.createdAt,
          })
        }
      })

      tx.immediate()
    })
  }
}

const POOL_IDLE_TIMEOUT = 2 * 60 * 1000
const POOL_GC_INTERVAL = 1 * 60 * 1000

export class StorePool {
  #stores: Map<Did, Store>
  #gcInterval: ReturnType<typeof setInterval>

  constructor() {
    this.#stores = new Map()
    this.#gcInterval = setInterval(() => this.#gc(), POOL_GC_INTERVAL)
  }

  #gc(): void {
    for (const store of this.#stores.values().toArray()) {
      if (store.millisSinceLastUsed > POOL_IDLE_TIMEOUT) {
        store.close()
      }
      if (store.isClosed) {
        this.#stores.delete(store.did)
      }
    }
  }

  close(): void {
    clearInterval(this.#gcInterval)
    this.#stores.forEach((store) => store.close())
    this.#stores.clear()
  }

  [Symbol.dispose](): void {
    this.close()
  }

  store(did: Did): Store {
    did = zDid.parse(did)
    let store = this.#stores.get(did)
    if (store == null || store.isClosed) {
      store = new Store(did)
      this.#stores.set(did, store)
    }
    return store
  }
}
