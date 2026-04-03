/* oxlint-disable no-unused-vars */

import {
  type AtIdentifierString,
  type DidString,
  InvalidDidError,
  InvalidHandleError,
  InvalidNsidError,
  InvalidRecordKeyError,
  type NsidString,
  type RecordKeyString,
  ensureValidAtIdentifier,
  ensureValidNsid,
  ensureValidRecordKey,
  isDidIdentifier,
} from '@atproto/syntax'

/**
 * Thrown by {@link AtHiddenUri} when the structure of an AT URI is invalid.
 * Note that {@link AtHiddenUri}'s constructor throws multiple specific errors depending on what's wrong with the URI, not just this structure error.
 */
export class InvalidUriError extends Error {}

/**
 * Represents the string type of {@link AtHiddenUri["protocol"]}, either `at:` or `athidden:`.
 */
export type AtHiddenUriProtocol = 'at:' | 'athidden:'

/**
 * Represents the string form of a restricted AT URI.
 * Supports both `at://` and `athidden://` protocols.
 * Allows any AT identifier for the repository component, and the collection and record key components are optional.
 */
export type AtHiddenUriString =
  | `${AtHiddenUriProtocol}//${AtIdentifierString}`
  | `${AtHiddenUriProtocol}//${AtIdentifierString}/${NsidString}`
  | `${AtHiddenUriProtocol}//${AtIdentifierString}/${NsidString}/${RecordKeyString}`

/**
 * Represents the string form of a "canonical" restricted AT URI.
 * Supports both `at://` and `athidden://` protocols.
 * Requires that the repository component is a valid {@link DidString}, and that the collection and record key components are present.
 */
export type AtHiddenCanonUriString =
  `${AtHiddenUriProtocol}//${DidString}/${NsidString}/${RecordKeyString}`

/**
 * Represents a refinement of the {@link AtHiddenUri} type, requiring that this object represents a "canonical" restricted AT URI.
 * The repository component must be a valid {@link DidString}, and the collection and record key components must be present.
 */
export interface AtHiddenCanonUri extends AtHiddenUri {
  readonly repo: DidString
  readonly collection: NsidString
  readonly rkey: RecordKeyString

  /**
   * Converts this object to a canonical restricted AT URI string.
   */
  toString(): AtHiddenCanonUriString
}

/**
 * Options used to create a new {@link AtHiddenUri} instance.
 */
export interface AtHiddenUriOptions {
  /**
   * If `true`, the URI will use the `athidden://` protocol, otherwise it will use the `at://` protocol.
   * Defaults to `false`.
   */
  hidden?: boolean

  /**
   * The repository component of the URI. This should be an {@link AtIdentifierString} and will be checked.
   */
  repo: string
  /**
   * The collection component of the URI. This should be a {@link NsidString} and will be checked.
   */
  collection?: string
  /**
   * The record key component of the URI. This should be a {@link RecordKeyString} and will be checked.
   */
  rkey?: string
}

/**
 * Represents a read-only restricted AT URI that may either use the `at://` or `athidden://` protocol.
 * @see {@link https://atproto.com/pt/specs/at-uri-scheme#restricted-at-uri-syntax}
 */
export class AtHiddenUri {
  /**
   * If `true`, this URI uses the `athidden://` protocol, otherwise it uses the `at://` protocol.
   * @see {@link AtHiddenUri["protocol"]}
   */
  hidden: boolean

  /** The repository component of the URI. */
  readonly repo: AtIdentifierString
  /** The collection component of the URI. */
  readonly collection?: NsidString
  /** The record key component of the URI. */
  readonly rkey?: RecordKeyString

  /**
   * Creates a new {@link AtHiddenUri} instance from a URI string or options object.
   * @param uriOrOptions Either a URI string, or an options object.
   * @throws {InvalidUriError} If the URI's structure is invalid.
   * @throws {InvalidHandleError} If the URI's handle is invalid.
   * @throws {InvalidNsidError} If the URI's collection is present but invalid.
   * @throws {InvalidRecordKeyError} If the URI's record key is present but invalid.
   */
  constructor(uriOrOptions: string | AtHiddenUriOptions) {
    const { hidden, repo, collection, rkey } =
      typeof uriOrOptions === 'string' ? uriStringToOptions(uriOrOptions) : uriOrOptions

    this.hidden = !!hidden

    if (!repo) {
      throw new InvalidUriError('AT URI must have a repo')
    }

    ensureValidAtIdentifier(repo)
    this.repo = repo
    if (collection != null) {
      ensureValidNsid(collection)
      this.collection = collection
      if (rkey != null) {
        ensureValidRecordKey(rkey)
        this.rkey = rkey
      }
    } else if (rkey != null) {
      throw new InvalidUriError('AT URI must have a collection when rkey is provided')
    }
  }

  /**
   * Parses a URI string into an {@link AtHiddenUri} instance, or returns `null` if the URI is invalid.
   * @param uri The URI string to parse.
   * @returns An {@link AtHiddenUri} instance, or `null` if the URI is invalid.
   */
  static parse(uri: string): AtHiddenUri | null {
    try {
      return new AtHiddenUri(uri)
    } catch {
      return null
    }
  }

  /**
   * Returns `true` if the {@link AtHiddenUri.repo} is a DID identifier.
   * @see {@link isDidIdentifier}
   */
  hasDid(): this is this & { repo: DidString } {
    return isDidIdentifier(this.repo)
  }

  /**
   * Returns `true` if the {@link AtHiddenUri.collection} is present.
   */
  hasCollection(): this is this & { collection: NsidString } {
    return !!this.collection
  }
  /**
   * Returns `true` if the {@link AtHiddenUri.collection} and {@link AtHiddenUri.rkey} are present.
   */
  hasRecord(): this is this & { collection: NsidString; rkey: RecordKeyString } {
    return !!this.collection && !!this.rkey
  }

  /**
   * Returns `true` if the {@link AtHiddenUri} is a canonical AT URI (i.e. it has a DID repo and a collection + rkey).
   */
  isCanon(): this is AtHiddenCanonUri {
    return this.hasDid() && this.hasRecord()
  }

  /**
   * Returns the protocol for this URI, either `at:` or `athidden:`.
   */
  get protocol(): AtHiddenUriProtocol {
    return this.hidden ? 'athidden:' : 'at:'
  }

  /**
   * Converts this object to a restricted AT URI string.
   */
  toString(): AtHiddenUriString {
    return `${this.protocol}//${this.repo}${this.collection ? `/${this.collection}` : ''}${this.rkey ? `/${this.rkey}` : ''}`
  }
}

/**
 * Converts an AT URI string into an {@link AtHiddenUriOptions} object.
 * @throws {InvalidUriError} if the URI is invalid.
 */
function uriStringToOptions(uri: string): AtHiddenUriOptions {
  if (uri.length > 8 * 1024) {
    throw new InvalidUriError('AT URI is far too long')
  }

  let hidden = false

  if (uri.startsWith('athidden://')) {
    uri = uri.slice(11)
    hidden = true
  } else if (uri.startsWith('at://')) {
    uri = uri.slice(5)
  } else {
    throw new InvalidUriError('AT URI must start with "at://" or "athidden://"')
  }

  const parts = uri.split('/')
  if (parts.length > 3) {
    throw new InvalidUriError('AT URI has too many segments')
  }

  const [repo, collection, rkey] = parts
  return { hidden, repo: repo!, collection, rkey }
}
