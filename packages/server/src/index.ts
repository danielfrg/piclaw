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

// Serve static files in production
if (isProd) {
  app.use("/*", serveStatic({ root: "./dist/static" }))
  app.get("*", serveStatic({ path: "./dist/static/index.html" }))
} else {
  app.get("/", (c) => {
    return c.text("Dev server is running. Only API routes are served.")
  })
}

export default {
  port: 3000,
  idleTimeout: 0, // Disable idle timeout for SSE connections
  fetch: app.fetch,
}
