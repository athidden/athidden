# athidden

Don't you miss [Twitter Circles](https://techcrunch.com/2023/11/01/the-demise-of-twitter-circles-left-a-void-that-instagram-close-friends-cant-fill/)?
What if Bluesky/ATProto had something similar?

athidden leverages the [Service Proxying](https://atproto.com/pt/specs/xrpc#service-proxying) mechanism, which is used by Bluesky DMs, to implement "hidden records" and a "hidden data server" (HDS). The HDS acts as a sidecar to the actual PDS, storing hidden records separately on a different server, without needing changes to the PDS itself.

To indicate how mysterious these hidden records are, everything is stored in the `ooo.bsky` namespace. There is also a website and a HDS hosted at https://bsky.ooo/ that is free for anyone to use. Just don't break it, thanks!

Basically, it's a hack. Instead of making a normal `app.bsky.feed.post` record with the text and blobs stored publicly on the PDS, you post an empty record to the PDS with a special `ooo.bsky.hidden.ref` field that contains a reference to the actual record on the HDS.
Blobs are still stored publicly on the PDS, but they're encrypted with [age](https://age-encryption.org/), and the keys are only present in the record on the HDS, keeping them out of reach of prying eyes.
Ideally, clients will add support for this! Either by using something like [`@athidden/fetch`](./packages/fetch) to retrieve the hidden record, by natively supporting the `ooo.bsky.hidden.ref` field in `app.bsky.feed.post` records, or by simply hiding the empty public records from view so they don't appear in feeds.

Is this perfect? No. Is this good? No. Does it leak information? Yes. Does it work? Yes.

Obviously, people can see the outlines of interactions. The posts are empty, but they still exist with timestamps and authors visible. If a thread builds up, one can still see the structure of the conversation, just without knowing what people are actually saying. This also goes for likes.

Additionally, blobs still appear publicly on the PDS, with an approximate size, but with the actual content remaining hidden. The keys are only present in the hidden record, and are randomly generated per blob. I know someone evil could steal the keys and then share them, but like, they could also just download the blob itself and share that, so it's whatever.

I hope you like my awful stopgap solution! One day we'll have real private/locked accounts, but until then, this is my best effort.

## License

Licensed under the [MIT License](LICENSE).

Made with ❤ by Lua ([foxgirl.dev](https://foxgirl.dev/)).
