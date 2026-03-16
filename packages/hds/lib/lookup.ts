import { ComAtprotoRepoGetRecord } from '@atcute/atproto'
import { isResourceUri } from '@atcute/lexicons'

import { parseResourceUri } from '@athidden/lexicons'

import { bluesky } from './bsky/client'
import type { PubRUri, Result, RUri } from './util'

export async function lookupRecord(uri: string, signal?: AbortSignal): Promise<Result<unknown>> {
  const result = parseResourceUri(uri)
  if (!result.ok) return result
}
