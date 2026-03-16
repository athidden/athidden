import { z } from 'zod'

import { type CanHidRUri, type CanRUri, type Cid, zCanHidRUri, zCanRUri, zCid } from '.'

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
