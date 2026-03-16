import * as CBOR from '@atcute/cbor'
import * as CID from '@atcute/cid'

export { CBOR, CID }

export function isEncodedCid(input: unknown): input is Uint8Array {
  return input instanceof Uint8Array && input.length === 36
}

export function cborEncode(value: unknown): Uint8Array {
  try {
    return CBOR.encode(value)
  } catch (err: any) {
    throw new (err?.constructor || Error)(`cborEncode: ${err?.message}`)
  }
}

export function cborDecode(value: Uint8Array): unknown {
  try {
    return CBOR.decode(value)
  } catch (err: any) {
    throw new (err?.constructor || Error)(`cborDecode length=${value.length}: ${err?.message}`)
  }
}

export function cidString2Blob(cid: string): Uint8Array {
  try {
    return CID.fromString(cid).bytes
  } catch (err: any) {
    throw new (err?.constructor || Error)(`cidString2Blob: ${err?.message}`)
  }
}

export function cidBlob2String(cid: Uint8Array): string {
  try {
    return CID.toString(CID.decode(cid))
  } catch (err: any) {
    throw new (err?.constructor || Error)(`cidBlob2String length=${cid.length}: ${err?.message}`)
  }
}
