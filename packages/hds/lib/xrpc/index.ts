import { XRPCRouter } from '@atcute/xrpc-server'
import { ServiceJwtVerifier } from '@atcute/xrpc-server/auth'
import { cors } from '@atcute/xrpc-server/middlewares/cors'

const jwtVerifier = new ServiceJwtVerifier({
  serviceDid: 'did:web:my-service.example.com',
  resolver: new CompositeDidDocumentResolver({
    methods: {
      plc: new PlcDidDocumentResolver(),
      web: new WebDidDocumentResolver(),
    },
  }),
})

export const router = new XRPCRouter({ middlewares: [cors()] })

// TODO: populate router with routes for all the xrpc endpoints
