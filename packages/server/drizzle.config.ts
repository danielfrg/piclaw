import path from "path"
import { fileURLToPath } from "url"
import { defineConfig } from "drizzle-kit"

const isProd = process.env.NODE_ENV === "production"
const dirname = path.dirname(fileURLToPath(import.meta.url))
const devDbPath = path.resolve(dirname, "..", "..", "data", "app.db")
const dbUrl = isProd ? "file:/data/app.db" : `file:${devDbPath}`

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/**/sql.ts",
  out: "./migration",
  dbCredentials: {
    url: dbUrl,
  },
})
