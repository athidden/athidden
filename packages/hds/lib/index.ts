import pino from 'pino'

export const rootLogger = pino({ level: 'trace' })

// TODO: implement main service setup and logic
// TODO: create server, serve .well-known/ and static files
// TODO: rate limiting logic to prevent evil shit
// TODO: limit body size

import * as CBOR from '@atcute/cbor'
import * as CID from '@atcute/cid'

import { StorePool } from './db'

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
