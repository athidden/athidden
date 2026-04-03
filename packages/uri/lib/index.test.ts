import { describe, expect, test } from 'bun:test'

import { InvalidHandleError, InvalidNsidError, InvalidRecordKeyError } from '@atproto/syntax'

import { AtHiddenUri, InvalidUriError } from './index'

const DID = 'did:plc:z72i7hdynmk6r22z27h6tvur'
const COLLECTION = 'app.bsky.feed.post'
const RKEY = '3l6oveex3ii2l'
const AT_URI = `at://${DID}/${COLLECTION}/${RKEY}`
const ATHIDDEN_URI = `athidden://${DID}/ooo.bsky.hidden.post/${RKEY}`

describe('AtHiddenUri', () => {
  test('parses full at:// URI', () => {
    const uri = new AtHiddenUri(AT_URI)
    expect(uri.hidden).toBe(false)
    expect(uri.repo).toBe(DID)
    expect(uri.collection).toBe(COLLECTION)
    expect(uri.rkey).toBe(RKEY)
  })

  test('parses full athidden:// URI', () => {
    const uri = new AtHiddenUri(ATHIDDEN_URI)
    expect(uri.hidden).toBe(true)
    expect(uri.collection).toBe('ooo.bsky.hidden.post')
  })

  test('parses repo-only and collection-only URIs', () => {
    const repoOnly = new AtHiddenUri(`at://${DID}`)
    expect(repoOnly.collection).toBeUndefined()
    expect(repoOnly.rkey).toBeUndefined()

    const withCollection = new AtHiddenUri(`at://${DID}/${COLLECTION}`)
    expect(withCollection.collection).toBe(COLLECTION)
    expect(withCollection.rkey).toBeUndefined()
  })

  test('constructs from options', () => {
    const uri = new AtHiddenUri({ hidden: true, repo: DID, collection: COLLECTION, rkey: RKEY })
    expect(uri.toString()).toBe(`athidden://${DID}/${COLLECTION}/${RKEY}`)
  })

  test('toString() roundtrips', () => {
    expect(new AtHiddenUri(AT_URI).toString()).toBe(AT_URI)
    expect(new AtHiddenUri(ATHIDDEN_URI).toString()).toBe(ATHIDDEN_URI)
    expect(new AtHiddenUri(`at://${DID}`).toString()).toBe(`at://${DID}`)
  })

  test('protocol reflects hidden flag', () => {
    expect(new AtHiddenUri(AT_URI).protocol).toBe('at:')
    expect(new AtHiddenUri(ATHIDDEN_URI).protocol).toBe('athidden:')
  })

  test('hasDid(), hasCollection(), hasRecord(), isCanon()', () => {
    const full = new AtHiddenUri(AT_URI)
    expect(full.hasDid()).toBe(true)
    expect(full.hasCollection()).toBe(true)
    expect(full.hasRecord()).toBe(true)
    expect(full.isCanon()).toBe(true)

    const handle = new AtHiddenUri(`at://bsky.app/${COLLECTION}/${RKEY}`)
    expect(handle.hasDid()).toBe(false)
    expect(handle.isCanon()).toBe(false)

    const repoOnly = new AtHiddenUri(`at://${DID}`)
    expect(repoOnly.hasCollection()).toBe(false)
    expect(repoOnly.hasRecord()).toBe(false)
    expect(repoOnly.isCanon()).toBe(false)
  })

  test('parse() returns null on invalid input', () => {
    expect(AtHiddenUri.parse('garbage')).toBeNull()
  })

  test('parse() returns AtHiddenUri on valid input', () => {
    const uri = AtHiddenUri.parse(AT_URI)
    expect(uri).toBeInstanceOf(AtHiddenUri)
    expect(uri!.repo).toBe(DID)
  })

  describe('error types', () => {
    test('InvalidUriError on bad protocol', () => {
      expect(() => new AtHiddenUri('https://example.com')).toThrow(InvalidUriError)
    })

    test('InvalidUriError on too many segments', () => {
      expect(() => new AtHiddenUri(`${AT_URI}/extra`)).toThrow(InvalidUriError)
    })

    test('InvalidUriError on missing repo', () => {
      expect(() => new AtHiddenUri('at://')).toThrow(InvalidUriError)
    })

    test('InvalidUriError on rkey without collection', () => {
      expect(() => new AtHiddenUri({ repo: DID, rkey: RKEY })).toThrow(InvalidUriError)
    })

    test('InvalidHandleError on malformed DID', () => {
      expect(() => new AtHiddenUri('at://did:bad')).toThrow(InvalidHandleError)
    })

    test('InvalidNsidError on bad collection', () => {
      expect(() => new AtHiddenUri(`at://${DID}/notansid`)).toThrow(InvalidNsidError)
    })

    test('InvalidRecordKeyError on bad rkey', () => {
      expect(() => new AtHiddenUri(`at://${DID}/${COLLECTION}/.`)).toThrow(InvalidRecordKeyError)
    })
  })
})
