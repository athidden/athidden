import { Database } from 'bun:sqlite'
import paths from 'node:path'

import { env } from '../env'

const CACHE_GC_INTERVAL = 5 * 60 * 1000

// oxfmt-ignore
export const cache = new Database(paths.join(env.HDS_DATA_DIRECTORY, 'cache.sqlite'), { strict: true })

{
  using stmt = cache.query('PRAGMA user_version')
  const { user_version } = stmt.get() as { user_version: number }
  if (user_version !== 0 && user_version !== 1) {
    process.exit(1)
  }
}

cache.run(`
PRAGMA user_version = 1;

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS identity (
  did TEXT PRIMARY KEY NOT NULL,
  did_doc BLOB NOT NULL,
  handle TEXT NOT NULL,
  pds TEXT,
  hds TEXT,
  fetched_at INTEGER NOT NULL DEFAULT (unixepoch())
) STRICT;

CREATE INDEX IF NOT EXISTS identity_handle ON identity (handle);
CREATE INDEX IF NOT EXISTS identity_fetched_at ON identity (fetched_at);

CREATE TABLE IF NOT EXISTS record (
  did TEXT NOT NULL,
  collection TEXT NOT NULL,
  rkey TEXT NOT NULL,
  uri TEXT NOT NULL,
  cid TEXT,
  value BLOB NOT NULL,
  fetched_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (did, collection, rkey)
) STRICT;

CREATE INDEX IF NOT EXISTS record_fetched_at ON record (fetched_at);

CREATE TABLE IF NOT EXISTS relationship (
  a_did TEXT NOT NULL,
  b_did TEXT NOT NULL,
  a_follows_b INTEGER NOT NULL,
  b_follows_a INTEGER NOT NULL,
  a_blocks_b INTEGER NOT NULL,
  b_blocks_a INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (a_did, b_did)
) STRICT;

CREATE INDEX IF NOT EXISTS relationship_fetched_at ON relationship (fetched_at);

CREATE TABLE IF NOT EXISTS membership (
  did TEXT NOT NULL,
  list_uri TEXT NOT NULL,
  is_member INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (actor, list)
) STRICT;

CREATE INDEX IF NOT EXISTS membership_fetched_at ON membership (fetched_at);
`)

setInterval(() => {}, CACHE_GC_INTERVAL)
