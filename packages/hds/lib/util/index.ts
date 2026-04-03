export type { Cid, Did, Nsid } from '@athidden/lexicons'

/** Picks the specified keys from an object, returning a new object with only those keys present. */
export const pick = (obj: any, keys: any[]) =>
  Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]))

/** Splits an array into chunks of the specified size. */
export const chunk = <T>(arr: T[], size: number): T[][] => {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export * from './result'
export * from './async'
export * from './types'
export * from './cbor-cid'
export * from './safe-fetch'
