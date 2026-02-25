export * from "./gen/types.gen.js"

import { createClient as genCreateClient } from "./gen/client/client.gen.js"
import { type Config } from "./gen/client/types.gen.js"
import { PiClient } from "./gen/sdk.gen.js"
export { type Config as ClientConfig, PiClient }

export function createClient(config?: Config) {
  if (!config?.fetch) {
    const customFetch: any = (req: any) => {
      // @ts-ignore
      req.timeout = false
      return fetch(req)
    }
    config = {
      ...config,
      fetch: customFetch,
    }
  }

  const client = genCreateClient(config)
  return new PiClient({ client })
}
