import { apiReference } from "@scalar/hono-api-reference"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { openAPIRouteHandler } from "hono-openapi"

import { SessionRoutes } from "@/routes/session"

export function createApp() {
  const app = new Hono()

  app.use(
    "/*",
    cors({
      origin: ["http://localhost:5173", "http://localhost:3000"],
      credentials: true,
    }),
  )

  app.route("/api/session", SessionRoutes())

  app.get("/", (c) => {
    return c.text("Pi server running. See /api/scalar for docs.")
  })

  app.get(
    "/api/openapi.json",
    openAPIRouteHandler(app, {
      documentation: {
        info: {
          title: "Pi Server API",
          version: "0.1.0",
        },
      },
    }),
  )

  app.get(
    "/api/scalar",
    apiReference({
      url: "/api/openapi.json",
    } as never),
  )

  return app
}
