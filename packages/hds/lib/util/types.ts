import {
  type CanonicalResourceUri,
  type RecordKey,
  type ResourceUri,
  isCanonicalResourceUri,
  isResourceUri,
} from '@atcute/lexicons'
import { isCid, isDid, isNsid, isRecordKey } from '@atcute/lexicons/syntax'

import {
  type CanonicalHiddenResourceUri,
  type CanonicalMaybeHiddenResourceUri,
  type HiddenResourceUri,
  type MaybeHiddenResourceUri,
  isCanonicalHiddenResourceUri,
  isCanonicalMaybeHiddenResourceUri,
  isHiddenResourceUri,
  isMaybeHiddenResourceUri,
} from '@athidden/lexicons'

import { z } from 'zod'

export type RKey = RecordKey

export const isRKey = isRecordKey

export type RUri = MaybeHiddenResourceUri
export type PubRUri = ResourceUri
export type HidRUri = HiddenResourceUri
export type CanRUri = CanonicalMaybeHiddenResourceUri
export type CanPubRUri = CanonicalResourceUri
export type CanHidRUri = CanonicalHiddenResourceUri

export const isRUri = isMaybeHiddenResourceUri
export const isPubRUri = isResourceUri
export const isHidRUri = isHiddenResourceUri
export const isCanRUri = isCanonicalMaybeHiddenResourceUri
export const isCanPubRUri = isCanonicalResourceUri
export const isCanHidRUri = isCanonicalHiddenResourceUri

export const zDid = z.string().refine(isDid)
export const zCid = z.string().refine(isCid)
export const zNsid = z.string().refine(isNsid)
export const zRKey = z.string().refine(isRKey)

export const zRUri = z.string().refine(isRUri)
export const zPubRUri = z.string().refine(isPubRUri)
export const zHidRUri = z.string().refine(isHidRUri)
export const zCanRUri = z.string().refine(isCanRUri)
export const zCanPubRUri = z.string().refine(isCanPubRUri)
export const zCanHidRUri = z.string().refine(isCanHidRUri)

export const zUint8Array = z.instanceof(Uint8Array)
