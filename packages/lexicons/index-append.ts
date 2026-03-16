// index-append.ts

import {
  type ActorIdentifier,
  type CanonicalResourceUri,
  type Did,
  type Nsid,
  type ParsedCanonicalResourceUri,
  type ParsedResourceUri,
  type RecordKey,
  type ResourceUri,
  isCanonicalResourceUri,
  isResourceUri,
  parseCanonicalResourceUri as originalParseCanonicalResourceUri,
  parseResourceUri as originalParseResourceUri,
} from '@atcute/lexicons'

export type {
  GenericUri,
  ResourceUri,
  CanonicalResourceUri,
  Cid,
  Did,
  Nsid,
  RecordKey,
} from '@atcute/lexicons'

export type HiddenResourceUri =
  | `athidden://${ActorIdentifier}`
  | `athidden://${ActorIdentifier}/${Nsid}`
  | `athidden://${ActorIdentifier}/${Nsid}/${RecordKey}`

export type MaybeHiddenResourceUri = ResourceUri | HiddenResourceUri

export type CanonicalHiddenResourceUri = `athidden://${Did}/${Nsid}/${RecordKey}`

export type CanonicalMaybeHiddenResourceUri = CanonicalResourceUri | CanonicalHiddenResourceUri

export function hasHiddenPrefix(input: string): boolean {
  return input.startsWith('athidden://')
}

function replaceHiddenPrefix(input: string): string {
  return hasHiddenPrefix(input) ? 'at' + input.substring(8) : input
}

export function isHiddenResourceUri(input: string): input is HiddenResourceUri {
  return (
    typeof input === 'string' &&
    hasHiddenPrefix(input) &&
    isHiddenResourceUri(replaceHiddenPrefix(input))
  )
}

export function isMaybeHiddenResourceUri(input: string): input is MaybeHiddenResourceUri {
  return typeof input === 'string' && isResourceUri(replaceHiddenPrefix(input))
}

export function isCanonicalHiddenResourceUri(input: unknown): input is CanonicalHiddenResourceUri {
  return (
    typeof input === 'string' &&
    hasHiddenPrefix(input) &&
    isCanonicalResourceUri(replaceHiddenPrefix(input))
  )
}

export function isCanonicalMaybeHiddenResourceUri(
  input: unknown,
): input is CanonicalMaybeHiddenResourceUri {
  return typeof input === 'string' && isCanonicalResourceUri(replaceHiddenPrefix(input))
}

export type UriParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

export function parseResourceUri(input: string): UriParseResult<ParsedResourceUri> {
  return originalParseResourceUri(input)
}

export function parseHiddenResourceUri(input: string): UriParseResult<ParsedResourceUri> {
  return hasHiddenPrefix(input)
    ? parseResourceUri(replaceHiddenPrefix(input))
    : { ok: false, error: `invalid hidden resource uri: ${input}` }
}

export function parseMaybeHiddenResourceUri(input: string): UriParseResult<ParsedResourceUri> {
  return parseResourceUri(replaceHiddenPrefix(input))
}

export function parseCanonicalResourceUri(
  input: string,
): UriParseResult<ParsedCanonicalResourceUri> {
  return originalParseCanonicalResourceUri(input)
}

export function parseCanonicalHiddenResourceUri(
  input: string,
): UriParseResult<ParsedCanonicalResourceUri> {
  return hasHiddenPrefix(input)
    ? parseCanonicalResourceUri(replaceHiddenPrefix(input))
    : { ok: false, error: `invalid hidden resource uri: ${input}` }
}

export function parseCanonicalMaybeHiddenResourceUri(
  input: string,
): UriParseResult<ParsedCanonicalResourceUri> {
  return parseCanonicalResourceUri(replaceHiddenPrefix(input))
}

export function parsedResourceUriToString<
  T extends ParsedResourceUri | ParsedCanonicalResourceUri,
  U = T extends ParsedCanonicalResourceUri ? CanonicalResourceUri : ResourceUri,
>(uri: T, hidden: boolean = false): U {
  const protocol = hidden ? 'athidden' : 'at'
  if (uri.collection) {
    if (uri.rkey) {
      return `${protocol}://${uri.repo}/${uri.collection}/${uri.rkey}${uri.fragment ? `#${uri.fragment}` : ''}` as any
    }
    return `${protocol}://${uri.repo}/${uri.collection}${uri.fragment ? `#${uri.fragment}` : ''}` as any
  }
  return `${protocol}://${uri.repo}${uri.fragment ? `#${uri.fragment}` : ''}` as any
}
