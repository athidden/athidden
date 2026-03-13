import { XRPCRouter } from '@atcute/xrpc-server'
import { cors } from '@atcute/xrpc-server/middlewares/cors'

export const router = new XRPCRouter({ middlewares: [cors()] })

// TODO: populate router with routes for all the xrpc endpoints
