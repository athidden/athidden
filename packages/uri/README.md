# @athidden/uri
Parse and validate [restricted AT URIs](https://atproto.com/pt/specs/at-uri-scheme#restricted-at-uri-syntax) with support for both `at://` and `athidden://` protocols.

## Usage

```ts
import { AtHiddenUri } from '@athidden/uri'

// Parse from a URI string
const uri = new AtHiddenUri('at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3l6oveex3ii2l')

uri.protocol   // 'at:'
uri.hidden     // false
uri.repo       // 'did:plc:z72i7hdynmk6r22z27h6tvur'
uri.collection // 'app.bsky.feed.post'
uri.rkey       // '3l6oveex3ii2l'
uri.toString() // 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3l6oveex3ii2l'

// athidden:// protocol
const hidden = new AtHiddenUri('athidden://did:plc:z72i7hdynmk6r22z27h6tvur/ooo.bsky.hidden.post/3l6oveex3ii2l')

hidden.protocol // 'athidden:'
hidden.hidden   // true

// Construct from options
const fromOpts = new AtHiddenUri({
  hidden: true,
  repo: 'did:plc:z72i7hdynmk6r22z27h6tvur',
  collection: 'app.bsky.feed.post',
  rkey: '3l6oveex3ii2l',
})
fromOpts.toString() // 'athidden://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3l6oveex3ii2l'

// Repo-only and collection-only URIs
const repoOnly = new AtHiddenUri('at://did:plc:z72i7hdynmk6r22z27h6tvur')
repoOnly.collection // undefined
repoOnly.rkey       // undefined

const withCollection = new AtHiddenUri('at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post')
withCollection.collection // 'app.bsky.feed.post'
withCollection.rkey       // undefined

// Handle-based URIs work too!
const handleUri = new AtHiddenUri('at://bsky.app/app.bsky.feed.post/3l6oveex3ii2l')
handleUri.repo // 'bsky.app'

// Type guards for narrowing
const full = new AtHiddenUri('at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3l6oveex3ii2l')

full.hasDid()        // true  - repo is a DID, not a handle
full.hasCollection() // true  - collection component is present
full.hasRecord()     // true  - both collection and rkey are present
full.isCanon()       // true  - DID repo + collection + rkey (canonical form!)

if (full.isCanon()) {
  console.log(full.rkey.length) // TypeScript knows that full.rkey is valid due to the type guard
}

// Safe parsing (returns null instead of throwing)
AtHiddenUri.parse('at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3l6oveex3ii2l') // AtHiddenUri
AtHiddenUri.parse('garbage') // null

// Validation errors
new AtHiddenUri('https://example.com')      // throws InvalidUriError (bad protocol)
new AtHiddenUri('at://did:bad')             // throws InvalidHandleError (malformed identifier)
new AtHiddenUri('at://did:plc:abc/bad')     // throws InvalidNsidError (invalid collection)
new AtHiddenUri('at://did:plc:abc/a.b.c/.') // throws InvalidRecordKeyError (invalid rkey)
```

## License
Licensed under the [MIT License](LICENSE).
