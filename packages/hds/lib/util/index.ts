export type { Cid, Did, Nsid } from '@athidden/lexicons'

export type MaybePromise<T> = T | Promise<T>

export const pick = (obj: any, keys: any[]) =>
  Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]))

export const chunk = <T>(arr: T[], size: number): T[][] => {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export const lazy = <T>(fn: () => T): (() => T) => {
  let value: T | undefined
  return () => {
    if (value === undefined) {
      value = fn()
    }
    return value
  }
}

export * from './result'
export * from './async'
export * from './types'
export * from './safe-cbor-cid'
export * from './safe-fetch'
export * from './box'
