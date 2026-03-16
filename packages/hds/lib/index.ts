import { AppBskyFeedPost } from '@atcute/bluesky'

import { getPublicRecord } from './bsky/get'
import { resolveIdentity } from './bsky/identity'
import { isOnList } from './bsky/list'
import { getRelationship } from './bsky/relationship'
import { StorePool } from './db'
import { CBOR, CID, Result } from './util'

process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))

// TODO: implement main service setup and logic
// TODO: create server, serve .well-known/ and static files
// TODO: rate limiting logic to prevent evil shit
// TODO: limit body size

using pool = new StorePool()

const s = pool.store('did:plc:fusxjk227zn4qcbrll5xa77m')

const hiddenRecord = {
  $type: 'app.bsky.feed.post',
  text: "that's such a cool post, mx. Alternative Account! did you know that this reply can only be read by people who i'm mutuals with? i wonder if anyone will read this ... if you read this text me 'bicycle' for a picture of my fursona",
  langs: ['en'],
  reply: {
    root: {
      cid: 'bafyreidv2ltxmbcdau3jk7aox5p25hcsabmvx7snnmyrzea4yycjgulnam',
      uri: 'at://did:plc:opp67v6yfzmojdu54emvsvmk/app.bsky.feed.post/3mgoyp32i2s2w',
    },
    parent: {
      cid: 'bafyreidv2ltxmbcdau3jk7aox5p25hcsabmvx7snnmyrzea4yycjgulnam',
      uri: 'at://did:plc:opp67v6yfzmojdu54emvsvmk/app.bsky.feed.post/3mgoyp32i2s2w',
    },
  },
  createdAt: '2026-03-10T10:18:10.038Z',
}

const encodedValue = CBOR.encode(hiddenRecord)
const encodedCid = (await CID.create(0x71, encodedValue)).bytes

s.upsertRecord({
  collection: 'app.bsky.feed.post',
  rkey: '3mgp5ikix7k2w',
  gateUri: 'at://did:plc:fusxjk227zn4qcbrll5xa77m/app.bsky.feed.threadgate/3lv5nhyxd6c2x',
  encodedCid,
  encodedValue,
  create: false,
})

const publicRecord = {
  $type: 'app.bsky.feed.post',
  text: '',
  langs: ['en'],
  reply: {
    root: {
      cid: 'bafyreidv2ltxmbcdau3jk7aox5p25hcsabmvx7snnmyrzea4yycjgulnam',
      uri: 'at://did:plc:opp67v6yfzmojdu54emvsvmk/app.bsky.feed.post/3mgoyp32i2s2w',
    },
    parent: {
      cid: 'bafyreidv2ltxmbcdau3jk7aox5p25hcsabmvx7snnmyrzea4yycjgulnam',
      uri: 'at://did:plc:opp67v6yfzmojdu54emvsvmk/app.bsky.feed.post/3mgoyp32i2s2w',
    },
  },
  createdAt: '2026-03-10T10:18:10.038Z',
  'ooo.bsky.hidden.ref': {
    boxUri: `athidden://${s.did}/${hiddenRecord.$type}/3mgp5ikix7k2w`,
    valueCid: encodedCid,
  },
}

console.log('getRecord1', s.getRecord({ collection: 'app.bsky.feed.post', rkey: '3mgp5ikix7k2w' }))

console.log(
  'deleteRecord',
  s.deleteRecord({
    collection: 'app.bsky.feed.post',
    rkey: '3mgp5ikix7k2w',
    //swapCid: 'bafyreid3gcm6wn7wtlm57agu2lxo5uraqvoevxennavfet7olcovvlv6fq',
  }),
)

console.log('getRecord2', s.getRecord({ collection: 'app.bsky.feed.post', rkey: '3mgp5ikix7k2w' }))

const meAndMyWife = getRelationship(
  'did:plc:fusxjk227zn4qcbrll5xa77m',
  'did:plc:h6wtgjicihpn2fx5ubb7rwow',
)
const myWifeAndMe = getRelationship(
  'did:plc:h6wtgjicihpn2fx5ubb7rwow',
  'did:plc:fusxjk227zn4qcbrll5xa77m',
)

const someoneFollowingMe = getRelationship(
  'did:plc:fusxjk227zn4qcbrll5xa77m',
  'did:plc:ecdbtk2kh6la4o2fxjqax7kp',
)
const someoneFollowingMeReversed = getRelationship(
  'did:plc:ecdbtk2kh6la4o2fxjqax7kp',
  'did:plc:fusxjk227zn4qcbrll5xa77m',
)

const idkThisGuy = getRelationship(
  'did:plc:fusxjk227zn4qcbrll5xa77m',
  'did:plc:zrkzsaqqa33namszrfxy525u',
)

for (let i = 0; i < 1000; i++) {
  const meAndMyWife = getRelationship(
    'did:plc:fusxjk227zn4qcbrll5xa77m',
    'did:plc:h6wtgjicihpn2fx5ubb7rwow',
  )
  const myWifeAndMe = getRelationship(
    'did:plc:h6wtgjicihpn2fx5ubb7rwow',
    'did:plc:fusxjk227zn4qcbrll5xa77m',
  )

  const someoneFollowingMe = getRelationship(
    'did:plc:fusxjk227zn4qcbrll5xa77m',
    'did:plc:ecdbtk2kh6la4o2fxjqax7kp',
  )
  const someoneFollowingMeReversed = getRelationship(
    'did:plc:ecdbtk2kh6la4o2fxjqax7kp',
    'did:plc:fusxjk227zn4qcbrll5xa77m',
  )

  const idkThisGuy = getRelationship(
    'did:plc:fusxjk227zn4qcbrll5xa77m',
    'did:plc:zrkzsaqqa33namszrfxy525u',
  )
}

const myWifeAndHerFriend = getRelationship(
  'did:plc:h6wtgjicihpn2fx5ubb7rwow',
  'did:plc:ecdbtk2kh6la4o2fxjqax7kp',
)

console.log({
  meAndMyWife: await meAndMyWife,
  myWifeAndMe: await myWifeAndMe,
  someoneFollowingMe: await someoneFollowingMe,
  someoneFollowingMeReversed: await someoneFollowingMeReversed,
  idkThisGuy: await idkThisGuy,
  myWifeAndHerFriend: await myWifeAndHerFriend,
})

console.log(await resolveIdentity('did:plc:fusxjk227zn4qcbrll5xa77m'))
console.log(await resolveIdentity('lua.pet'))
try {
  console.log(await resolveIdentity('bsky.ooo'))
} catch (error: any) {
  console.error('expected error:', error?.message)
}

console.log(
  'check this shit out:',
  await getPublicRecord({
    uri: 'at://lua.pet/app.bsky.feed.post/3mh5pglwxqs23',
    schema: AppBskyFeedPost.mainSchema,
  }),
)

const meeee = Result.unwrap(await resolveIdentity('lua.pet'))

console.log(
  'they hate me noooo:',
  await isOnList(meeee.did, 'at://cblovedones.bsky.social/app.bsky.graph.list/3mg2nmu35lz2j'),
)
