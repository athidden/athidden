import * as CBOR from '@atcute/cbor'
import * as CID from '@atcute/cid'
import {
  type CanonicalResourceUri,
  type Cid,
  type Did,
  type Nsid,
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

export type { Cid, Did, Nsid } from '@athidden/lexicons'

export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E }

export const pick = (obj: any, keys: any[]) =>
  Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]))

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

export interface Box {
  gateUri: CanRUri
  uri: CanHidRUri
  cid: Cid
  value: unknown
}
export const Box = z.object({
  gateUri: zCanRUri,
  uri: zCanHidRUri,
  cid: zCid,
  value: z.any(),
})

export { CBOR, CID }

export function isEncodedCid(input: unknown): input is Uint8Array {
  return input instanceof Uint8Array && input.length === 36
}

export function cborEncode(value: unknown): Uint8Array {
  try {
    return CBOR.encode(value)
  } catch (err: any) {
    throw new (err.constructor || Error)(`cborEncode: ${err?.message}`)
  }
}

export function cborDecode(value: Uint8Array): unknown {
  try {
    return CBOR.decode(value)
  } catch (err: any) {
    throw new (err.constructor || Error)(`cborDecode length=${value.length}: ${err?.message}`)
  }
}

export function cidString2Blob(cid: string): Uint8Array {
  try {
    return CID.fromString(cid).bytes
  } catch (err: any) {
    throw new (err.constructor || Error)(`cidString2Blob: ${err?.message}`)
  }
}

export function cidBlob2String(cid: Uint8Array): string {
  try {
    return CID.toString(CID.decode(cid))
  } catch (err: any) {
    throw new (err.constructor || Error)(`cidBlob2String length=${cid.length}: ${err?.message}`)
  }
}
