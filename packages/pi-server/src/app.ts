import { apiReference } from "@scalar/hono-api-reference"
import { Hono } from "hono"
import { serveStatic } from "hono/bun"
import { cors } from "hono/cors"
import { openAPIRouteHandler } from "hono-openapi"

import { SessionRoutes } from "@/routes/session"

export function createApp() {
  const app = new Hono()
  const isProd = process.env.NODE_ENV === "production"

  app.use(
    "/*",
    cors({
      origin: ["http://localhost:5173", "http://localhost:3000"],
      credentials: true,
    }),
  )

  app.route("/api/session", SessionRoutes())

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

  if (isProd) {
    app.use("/*", serveStatic({ root: "./dist/static" }))
    app.get("*", serveStatic({ path: "./dist/static/index.html" }))
  } else {
    const devServer = process.env.PI_WEB_DEV_SERVER ?? "http://localhost:5173"

    app.all("*", async (c) => {
      const url = new URL(c.req.url)
      const target = new URL(devServer)
      const targetUrl = `${target.origin}${url.pathname}${url.search}`
      const headers = new Headers(c.req.raw.headers)

      headers.set("host", target.host)
      headers.set("origin", target.origin)

      try {
        const response = await fetch(targetUrl, {
          method: c.req.method,
          headers,
          body: c.req.method !== "GET" && c.req.method !== "HEAD" ? c.req.raw.body : undefined,
        })

        return new Response(response.body, {
          status: response.status,
          headers: response.headers,
        })
      } catch {
        return c.text("Vite dev server not running. Start it with: cd packages/pi-web && bun run dev", 502)
      }
    })
  }

  return app
}
