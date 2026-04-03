import * as CBOR from '@atcute/cbor'
import * as CID from '@atcute/cid'

export { CBOR, CID }

/** Encodes a JSON-like value/structure as CBOR. Throws on error. */
export function cborEncode(value: unknown): Uint8Array {
  try {
    return CBOR.encode(value)
  } catch (err: any) {
    throw new (err?.constructor || Error)(`cborEncode: ${err?.message}`)
  }
}

/** Decodes a CBOR-encoded value/structure. Throws on error. */
export function cborDecode(value: Uint8Array): unknown {
  try {
    return CBOR.decode(value)
  } catch (err: any) {
    throw new (err?.constructor || Error)(`cborDecode length=${value.length}: ${err?.message}`)
  }
}

/** Converts a CID string to a Uint8Array blob. Throws on error. */
export function cidString2Blob(cid: string): Uint8Array {
  try {
    return CID.fromString(cid).bytes
  } catch (err: any) {
    throw new (err?.constructor || Error)(`cidString2Blob: ${err?.message}`)
  }
}

/** Converts a Uint8Array blob to a CID string. Throws on error. */
export function cidBlob2String(cid: Uint8Array): string {
  try {
    return CID.toString(CID.decode(cid))
  } catch (err: any) {
    throw new (err?.constructor || Error)(`cidBlob2String length=${cid.length}: ${err?.message}`)
  }
}
