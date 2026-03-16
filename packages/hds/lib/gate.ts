import type { Did, OooBskyHiddenGate } from '@athidden/lexicons'

export interface GateParams {
  gate: OooBskyHiddenGate.Main
  author: Did
  viewer: Did
}

/*

import type { } from '@atcute/bluesky'
import { AppBskyFeedGetPostThread, AppBskyFeedPost } from '@atcute/bluesky'
import { Client, ok, simpleFetchHandler } from '@atcute/client'

import { type CanonicalResourceUri, type Did, OooBskyHiddenGate } from '@athidden/lexicons'

const rpc = new Client({ handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' }) })

// TODO: implement xrpc authentication logic
// TODO: implement gate logic

export interface GateParams {
  gate: OooBskyHiddenGate.Main
  author: Did
  viewer: Did
  post?: {
    uri: CanonicalResourceUri
    record: AppBskyFeedPost.Main
  }
}

export async function doesGateAllowViewer(context: GateParams): Promise<boolean> {
  const { gate, author, viewer, post } = context

  if (viewer === author) {
    return true
  }

  if (gate.allow == null || gate.allow.length < 1) {
    return false
  }

  for (const rule of gate.allow) {
    const type = rule.$type
    if (type === 'ooo.bsky.hidden.gate#everyoneRule') {
      return true
    } else if (type === 'ooo.bsky.hidden.gate#authorFollowsRule') {
      rpc.get('app.bsky.graph.getRelationships')
    } else if (type === 'ooo.bsky.hidden.gate#followingAuthorRule') {
    } else if (type === 'ooo.bsky.hidden.gate#mutualsRule') {
    } else if (type === 'ooo.bsky.hidden.gate#actorRule') {
    } else if (type === 'ooo.bsky.hidden.gate#listRule') {
    }
  }

  return false
}
 */
