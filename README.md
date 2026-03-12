# athidden

Don't you miss [Twitter Circles](https://techcrunch.com/2023/11/01/the-demise-of-twitter-circles-left-a-void-that-instagram-close-friends-cant-fill/)?
What if Bluesky/ATProto had something similar?

athidden leverages the [Service Proxying](https://atproto.com/pt/specs/xrpc#service-proxying) mechanism, which is used by Bluesky DMs, to implement "hidden records" and a "hidden data server" (HDS). The HDS acts as a sidecar to the actual PDS, storing hidden records separately on a different server, without needing changes to the PDS itself.

To indicate how mysterious these hidden records are, everything is stored in the `ooo.bsky` namespace. There is also a website and a HDS hosted at https://bsky.ooo/ that is free for anyone to use. Just don't break it, thanks!

I'm not the first animal to think about this, there is plenty of prior art:

- "Encryption for private content #121" https://github.com/bluesky-social/atproto/discussions/121
- "Private, non-shared data in repo? #3363" https://github.com/bluesky-social/atproto/discussions/3363
- "Private Service Proxying #2333" https://github.com/bluesky-social/atproto/discussions/2333
- "Proposal: Access-Controlled Blobs via Signed URLs" https://gist.github.com/ngerakines/f50c17a2c2d50d67c0276aa54147ab22
- "Private Data Working Group" https://atproto.wiki/en/working-groups/private-data https://discourse.atprotocol.community/c/privatedatawg/16
- "Proposal: 0011 Auth Scopes for ATProto" https://github.com/bluesky-social/proposals/tree/main/0011-auth-scopes
- Bluesky DMs - You've probably used them before
- Germ Network https://www.germnetwork.com/ - Also pretty cool, still DMs, works
- Paul Frazee's "Private data: developing a rubric for success" https://pfrazee.leaflet.pub/3lzhmtognls2q
- Paul Frazee's "Three schemes for shared-private storage" https://pfrazee.leaflet.pub/3lzhui2zbxk2b

I would definitely recommend checking out the blog posts by Paul Frazee. My solution follows their "hosted arena scheme" and, while data stored on the HDS is "unsigned", the PDS is of course signed & verified & trusted, and the `ooo.bsky.hidden.ref` field on the PDS holds a CID that allows clients to confirm the authenticity of the hidden record.

Basically it's my awesome hack. Instead of making a normal `app.bsky.feed.post` record with the text and blobs stored publicly on the PDS, you post an empty record to the PDS with a special `ooo.bsky.hidden.ref` field that contains a reference to the actual record on the HDS.
Blobs are still stored publicly on the PDS, but they're encrypted with [age](https://age-encryption.org/), and the keys are only present in the record on the HDS, keeping them out of reach of prying eyes.
Ideally, clients will add support for this! Either by using something like [`@athidden/fetch`](./packages/fetch) to retrieve the hidden record, by natively supporting the `ooo.bsky.hidden.ref` field in `app.bsky.feed.post` records, or by simply hiding the empty public records from view so they don't appear in feeds.

The general flow is:

1. social-app detects a `ooo.bsky.hidden.ref` field in a `app.bsky.feed.post` record
2. social-app finds the `#athidden_hds` service (of type `AthiddenHiddenDataServer`) in the author's DID document
3. social-app performs a service-proxied XRPC request to the HDS to retrieve the hidden record via `ooo.bsky.hidden.getRecords`
4. the HDS recieves the request and authenticates the client
5. the HDS looks up the hidden record, then finds the record's associated `ooo.bsky.hidden.gate`
6. the HDS confirms that the client is authorized to access the record according to the rules of the gate
7. if everything checks out, the HDS boxes the hidden record in a `ooo.bsky.hidden.box` response
8. social-app compares the `ooo.bsky.hidden.ref` and the returned `ooo.bsky.hidden.box` to confirm that the CIDs match and the record is valid
9. social-app replaces the empty public record with the hidden record
10. optionally, social-app detects a `ooo.bsky.hidden.encryptedBlobKeys` field in the hidden `app.bsky.feed.post` record, and uses the keys to decrypt any attached blobs before presenting them - you could also use a fancy trusted CDN for this

Is this perfect? No. Is this good? No. Does it leak information? Yes. Does it work? Yes.

Obviously, people can see the outlines of interactions. The posts are empty, but they still exist with timestamps and authors visible. If a thread builds up, one can still see the structure of the conversation, just without knowing what people are actually saying. This also goes for likes.

However, it is completely possible to create hidden records that are not linked to any public post, so ideally in the future this would be improved and more facets of the interactions could be hidden. Consider a user only exposing a single public record that simply declares they have hidden all their other posts, then storing the post records exclusively in the HDS.

Additionally, blobs still appear publicly on the PDS, with an approximate size, but with the actual content remaining hidden. The keys are only present in the hidden record, and are randomly generated per blob. I know someone evil could steal the keys and then share them, but like, they could also just download the blob itself and share that, so it's whatever.

As for backups and data integrity: for simplicity and due to the nature of this system, I don't implement the cryptographically-verified repo system that the PDS uses. The HDS is really just a fancy key-value store with permission checks. Still, I do generate + store + check the CIDs of hidden records to ensure nothing weird happens. And, to make backups and migrations easier, the `ooo.bsky.hds.{importAccount/exportAccount}` endpoints are provided, which use CAR files to import/export all hidden records for an account.

I hope you like my stopgap solution! One day we'll have real private/locked accounts, but until then, this is my best effort.

## License

Licensed under the [MIT License](LICENSE).

Made with ❤ by Lua ([foxgirl.dev](https://foxgirl.dev/)).
