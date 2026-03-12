import { XRPCRouter, json } from '@atcute/xrpc-server'
import { cors } from '@atcute/xrpc-server/middlewares/cors'

import { OooBskyHdsGetRecords } from '@athidden/lexicons'

const router = new XRPCRouter({ middlewares: [cors()] })

router.addQuery(OooBskyHdsGetRecords, {
  async handler({ params }) {
    return json({})
  },
})

export default router
