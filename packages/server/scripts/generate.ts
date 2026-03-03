import { generateSpecs } from "hono-openapi"

import { createApp } from "@/app"

const app = createApp()

const specs = await generateSpecs(app, {
  documentation: {
    info: {
      title: "Pi Server API",
      version: "0.1.0",
    },
  },
})

console.log(JSON.stringify(specs, null, 2))
