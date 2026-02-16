import { Hono } from "hono"
import { cors } from "hono/cors"
import { serveStatic } from "hono/bun"

const isProd = process.env.NODE_ENV === "production"

export const app = new Hono()

app.use(
  "/*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  }),
)

if (isProd) {
  // Prod: Serve static files
  app.use("/*", serveStatic({ root: "./dist/static" }))
  app.get("*", serveStatic({ path: "./dist/static/index.html" }))
} else {
  // Dev: proxy to localhost vite server
  const VITE_DEV_SERVER = "http://localhost:5173"

  app.all("*", async (c) => {
    const url = new URL(c.req.url)
    const targetUrl = `${VITE_DEV_SERVER}${url.pathname}${url.search}`

    try {
      const response = await fetch(targetUrl, {
        method: c.req.method,
        headers: c.req.raw.headers,
        body: c.req.method !== "GET" && c.req.method !== "HEAD" ? c.req.raw.body : undefined,
      })

      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      })
    } catch {
      return c.text("Vite dev server not running. Start it with: cd packages/web && bun run dev", 502)
    }
  })
}

export default {
  port: 3000,
  idleTimeout: 0, // Disable idle timeout for SSE connections
  fetch: app.fetch,
}
