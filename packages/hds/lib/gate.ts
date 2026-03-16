import type { Did, OooBskyHiddenGate } from '@athidden/lexicons'

import { resolveDid } from './bsky/identity'
import { isOnList } from './bsky/list'
import { getRelationship } from './bsky/relationship'
import { rootLogger } from './logger'
import { Result } from './util'

const gateLogger = rootLogger.child({ name: 'gate' })

export interface GateParams {
  gate: OooBskyHiddenGate.Main
  author: Did
  viewer: Did
}

export async function doesGateAllowViewer({ gate, author, viewer }: GateParams): Promise<boolean> {
  if (author === viewer) {
    return true
  }

  if (gate.allow == null || gate.allow.length < 1) {
    return false
  }

  for (const rule of gate.allow) {
    switch (rule.$type) {
      case 'ooo.bsky.hidden.gate#everyoneRule':
        return true

      case 'ooo.bsky.hidden.gate#authorFollowsRule': {
        const result = await getRelationship(author, viewer)
        if (!result.ok) {
          gateLogger.debug({ author, viewer }, 'getRelationship failed: ' + Result.toString(result))
        } else {
          if (result.value.aFollowsB) return true
        }
        break
      }

      case 'ooo.bsky.hidden.gate#followingAuthorRule': {
        const result = await getRelationship(viewer, author)
        if (!result.ok) {
          gateLogger.debug({ viewer, author }, 'getRelationship failed: ' + Result.toString(result))
        } else {
          if (result.value.aFollowsB) return true
        }
        break
      }

      case 'ooo.bsky.hidden.gate#mutualsRule': {
        const result = await getRelationship(author, viewer)
        if (!result.ok) {
          gateLogger.debug({ author, viewer }, 'getRelationship failed: ' + Result.toString(result))
        } else {
          if (result.value.aFollowsB && result.value.bFollowsA) return true
        }
        break
      }

      case 'ooo.bsky.hidden.gate#listRule': {
        const result = await isOnList(viewer, rule.list)
        if (!result.ok) {
          gateLogger.debug({ list: rule.list }, 'isOnList failed: ' + Result.toString(result))
        } else {
          if (result.value) return true
        }
        break
      }

      case 'ooo.bsky.hidden.gate#actorRule': {
        const result = await resolveDid(rule.actor)
        if (!result.ok) {
          gateLogger.debug({ actor: rule.actor }, 'resolveDid failed: ' + Result.toString(result))
        } else {
          if (result.value === viewer) return true
        }
        break
      }
    }
  }

  return false
}
